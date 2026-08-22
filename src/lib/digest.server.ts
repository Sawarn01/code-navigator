import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { escapeHtml, sendEmail } from "@/lib/email.server";

export type DigestResult = { processed: number; sent: number; skipped: number; errors: string[] };

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

function renderEmail(input: {
  name: string;
  points: number;
  solved: number;
  rank: number | null;
  streak: number;
  events: { title: string; start_time: string }[];
}) {
  const events = input.events.length
    ? input.events
        .map(
          (e) =>
            `<li style="margin:4px 0">${escapeHtml(e.title)} — ${new Date(e.start_time)
              .toISOString()
              .slice(0, 16)
              .replace("T", " ")} UTC</li>`,
        )
        .join("")
    : '<li style="margin:4px 0">Nothing scheduled yet — check back soon.</li>';

  return `<div style="font-family:Inter,Segoe UI,sans-serif;background:#ffffff;color:#1e1b4b;padding:24px">
    <h1 style="font-size:22px;margin:0 0 4px">Your week on Space</h1>
    <p style="color:#4f46e5;margin:0 0 20px">Hi ${escapeHtml(input.name)}, here's your recap.</p>
    <table style="width:100%;border-collapse:separate;border-spacing:8px">
      <tr>
        <td style="background:#eef2ff;border-radius:12px;padding:14px"><strong style="font-size:20px">${input.points}</strong><br/>points earned</td>
        <td style="background:#eef2ff;border-radius:12px;padding:14px"><strong style="font-size:20px">${input.solved}</strong><br/>problems solved</td>
      </tr>
      <tr>
        <td style="background:#eef2ff;border-radius:12px;padding:14px"><strong style="font-size:20px">${input.rank ?? "—"}</strong><br/>current rank</td>
        <td style="background:#eef2ff;border-radius:12px;padding:14px"><strong style="font-size:20px">${input.streak}</strong><br/>day streak</td>
      </tr>
    </table>
    <h2 style="font-size:16px;margin:24px 0 8px">Coming up</h2>
    <ul style="padding-left:18px;margin:0;color:#3730a3">${events}</ul>
    <p style="margin-top:24px;font-size:12px;color:#6b7280">Don't want this? Turn off the weekly digest in your Space settings.</p>
  </div>`;
}

export async function runWeeklyDigest(): Promise<DigestResult> {
  const supabase = adminClient();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const result: DigestResult = { processed: 0, sent: 0, skipped: 0, errors: [] };

  const [{ data: prefs }, { data: profiles }, { data: events }, authUsers] = await Promise.all([
    supabase.from("notification_preferences").select("user_id, email_digest"),
    supabase.from("profiles").select("id, full_name, points, streak_count"),
    supabase
      .from("events")
      .select("title, start_time")
      .gte("start_time", new Date().toISOString())
      .order("start_time")
      .limit(4),
    supabase.auth.admin.listUsers({ page: 1, perPage: 500 }),
  ]);

  const optedOut = new Set(
    (prefs ?? []).filter((p) => p.email_digest === false).map((p) => p.user_id),
  );
  const emailById = new Map(
    (authUsers.data?.users ?? []).map((u) => [u.id, u.email ?? null] as const),
  );

  const ranked = [...(profiles ?? [])].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

  for (const [index, profile] of ranked.entries()) {
    result.processed += 1;
    const email = emailById.get(profile.id);
    if (!email || optedOut.has(profile.id)) {
      result.skipped += 1;
      continue;
    }

    const { data: subs } = await supabase
      .from("submissions")
      .select("points_awarded, status")
      .eq("user_id", profile.id)
      .gte("submitted_at", since);

    const weekPoints = (subs ?? []).reduce((sum, s) => sum + (s.points_awarded ?? 0), 0);
    const solved = (subs ?? []).filter((s) => s.status === "accepted").length;

    try {
      await sendEmail(
        email,
        "Your week on Space",
        renderEmail({
          name: profile.full_name ?? "there",
          points: weekPoints,
          solved,
          rank: index + 1,
          streak: profile.streak_count ?? 0,
          events: events ?? [],
        }),
      );
      result.sent += 1;
    } catch (error) {
      result.errors.push(`${profile.id}: ${(error as Error).message}`);
    }
  }

  return result;
}
