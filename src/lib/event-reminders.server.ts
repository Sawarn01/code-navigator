import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { escapeHtml, sendEmail } from "@/lib/email.server";

export type EventReminderResult = {
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
};

function adminClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function renderReminderEmail(
  name: string,
  title: string,
  startTime: string,
  location: string | null,
) {
  const when = new Date(startTime).toISOString().slice(0, 16).replace("T", " ");
  return `<div style="font-family:Inter,Segoe UI,sans-serif;background:#ffffff;color:#1e1b4b;padding:24px">
    <h1 style="font-size:20px;margin:0 0 8px">Reminder: ${escapeHtml(title)}</h1>
    <p style="margin:0 0 16px">Hi ${escapeHtml(name)}, this is happening in about 24 hours.</p>
    <table style="width:100%;border-collapse:separate;border-spacing:8px">
      <tr>
        <td style="background:#eef2ff;border-radius:12px;padding:14px"><strong>${when} UTC</strong><br/>start time</td>
        ${
          location
            ? `<td style="background:#eef2ff;border-radius:12px;padding:14px"><strong>${escapeHtml(
                location,
              )}</strong><br/>location</td>`
            : ""
        }
      </tr>
    </table>
    <p style="margin-top:24px;font-size:12px;color:#6b7280">Don't want these? Turn off event reminders in your Space settings.</p>
  </div>`;
}

/** Emails + in-app-notifies everyone registered/waitlisted for an event starting in ~24h, once. */
export async function runEventReminders(): Promise<EventReminderResult> {
  const supabase = adminClient();
  const result: EventReminderResult = { processed: 0, sent: 0, skipped: 0, errors: [] };

  const windowStart = new Date(Date.now() + 23 * 3600000).toISOString();
  const windowEnd = new Date(Date.now() + 25 * 3600000).toISOString();

  const [{ data: events }, { data: prefs }, authUsers] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, start_time, location")
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd),
    supabase.from("notification_preferences").select("user_id, event_reminder"),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (!events?.length) return result;

  const optedOut = new Set(
    (prefs ?? []).filter((p) => p.event_reminder === false).map((p) => p.user_id),
  );
  const emailById = new Map(
    (authUsers.data?.users ?? []).map((u) => [u.id, u.email ?? null] as const),
  );

  for (const event of events) {
    const { data: regs } = await supabase
      .from("event_registrations")
      .select("id, user_id")
      .eq("event_id", event.id)
      .in("status", ["registered", "waitlisted"])
      .is("reminder_sent_at", null);

    for (const reg of regs ?? []) {
      result.processed += 1;
      const email = emailById.get(reg.user_id);
      if (!email || optedOut.has(reg.user_id)) {
        result.skipped += 1;
        continue;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", reg.user_id)
        .maybeSingle();

      try {
        await sendEmail(
          email,
          `Reminder: ${event.title} is coming up`,
          renderReminderEmail(
            profile?.full_name ?? "there",
            event.title,
            event.start_time,
            event.location,
          ),
        );
        await supabase.rpc("create_notification", {
          _user_id: reg.user_id,
          _type: "event_reminder",
          _title: `${event.title} starts soon`,
          _body: "It starts in about 24 hours.",
          _link: `/events/${event.id}`,
        });
        await supabase
          .from("event_registrations")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", reg.id);
        result.sent += 1;
      } catch (error) {
        result.errors.push(`${reg.user_id}: ${(error as Error).message}`);
      }
    }
  }

  return result;
}
