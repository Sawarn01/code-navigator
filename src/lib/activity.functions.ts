import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ActivityItem = {
  id: string;
  type: "submission" | "badge" | "certificate" | "event_registration";
  createdAt: string;
  title: string;
  meta: string | null;
};

export const getMyActivityFeed = createServerFn({ method: "POST" })
  .inputValidator((input: { limit?: number }) => ({
    limit: Math.min(50, Math.max(1, Math.round(Number(input?.limit) || 20))),
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<ActivityItem[]> => {
    const { data: rows } = await context.supabase
      .from("activity_events")
      .select("id, type, payload, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (!rows?.length) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payloadOf = (r: (typeof rows)[number]) => r.payload as Record<string, unknown>;

    const questionIds = rows
      .filter((r) => r.type === "submission")
      .map((r) => payloadOf(r)["question_id"] as string)
      .filter(Boolean);
    const badgeIds = rows
      .filter((r) => r.type === "badge")
      .map((r) => payloadOf(r)["badge_id"] as string)
      .filter(Boolean);
    const courseIds = rows
      .filter((r) => r.type === "certificate")
      .map((r) => payloadOf(r)["course_id"] as string)
      .filter(Boolean);
    const eventIds = rows
      .filter((r) => r.type === "event_registration")
      .map((r) => payloadOf(r)["event_id"] as string)
      .filter(Boolean);

    const [{ data: questions }, { data: badges }, { data: courses }, { data: events }] =
      await Promise.all([
        questionIds.length
          ? supabaseAdmin.from("questions").select("id, title").in("id", questionIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        badgeIds.length
          ? supabaseAdmin.from("badges").select("id, name").in("id", badgeIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        courseIds.length
          ? supabaseAdmin.from("courses").select("id, title").in("id", courseIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        eventIds.length
          ? supabaseAdmin.from("events").select("id, title").in("id", eventIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      ]);
    const qTitle = new Map((questions ?? []).map((q) => [q.id, q.title]));
    const bName = new Map((badges ?? []).map((b) => [b.id, b.name]));
    const cTitle = new Map((courses ?? []).map((c) => [c.id, c.title]));
    const eTitle = new Map((events ?? []).map((e) => [e.id, e.title]));

    return rows.map((r): ActivityItem => {
      const p = payloadOf(r);
      const type = r.type as ActivityItem["type"];
      switch (type) {
        case "submission":
          return {
            id: r.id,
            type,
            createdAt: r.created_at,
            title: qTitle.get(p["question_id"] as string) ?? "a problem",
            meta: p["points_awarded"] ? `+${p["points_awarded"]} points` : null,
          };
        case "badge":
          return {
            id: r.id,
            type,
            createdAt: r.created_at,
            title: bName.get(p["badge_id"] as string) ?? "a badge",
            meta: null,
          };
        case "certificate":
          return {
            id: r.id,
            type,
            createdAt: r.created_at,
            title: cTitle.get(p["course_id"] as string) ?? "a course",
            meta: null,
          };
        case "event_registration":
          return {
            id: r.id,
            type,
            createdAt: r.created_at,
            title: eTitle.get(p["event_id"] as string) ?? "an event",
            meta: null,
          };
      }
    });
  });
