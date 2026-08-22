import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const NOTIFICATION_TYPES = [
  "badge_earned",
  "forum_reply",
  "event_reminder",
  "streak_risk",
  "mentor_note",
  "group_invite",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationPrefs = Record<NotificationType, boolean> & { email_digest: boolean };

const DEFAULT_PREFS: NotificationPrefs = {
  badge_earned: true,
  forum_reply: true,
  event_reminder: true,
  streak_risk: true,
  mentor_note: true,
  group_invite: true,
  email_digest: true,
};

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: AppNotification[]; unread: number }> => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const items = (data ?? []) as AppNotification[];
    return { items, unread: items.filter((n) => !n.is_read).length };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids?: string[] }) => ({
    ids: Array.isArray(input?.ids) ? input.ids.map(String).slice(0, 100) : undefined,
  }))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", context.userId)
      .eq("is_read", false);
    if (data.ids?.length) query = query.in("id", data.ids);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationPrefs> => {
    const { data } = await context.supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) {
      await context.supabase
        .from("notification_preferences")
        .insert({ user_id: context.userId });
      return DEFAULT_PREFS;
    }
    const row = data as Record<string, boolean>;
    const prefs = { ...DEFAULT_PREFS };
    for (const key of Object.keys(prefs) as (keyof NotificationPrefs)[]) {
      if (typeof row[key] === "boolean") prefs[key] = row[key];
    }
    return prefs;
  });

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<NotificationPrefs>) => {
    const patch: Record<string, boolean> = {};
    for (const key of Object.keys(DEFAULT_PREFS)) {
      const value = (input as Record<string, unknown>)[key];
      if (typeof value === "boolean") patch[key] = value;
    }
    return patch;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notification_preferences")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirm: string }) => ({ confirm: String(input?.confirm ?? "") }))
  .handler(async ({ data, context }) => {
    if (data.confirm !== "DELETE") throw new Error('Type DELETE to confirm');
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
