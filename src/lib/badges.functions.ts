import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverPublicClient } from "@/lib/supabase-server";

export type BadgeCatalogEntry = {
  id: string;
  name: string;
  description: string | null;
  criteria_description: string | null;
  icon_url: string | null;
  earned_count: number;
};

/** Public: every badge plus how many students have earned it. No per-user state. */
export const getBadgeCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<BadgeCatalogEntry[]> => {
    const supabase = serverPublicClient();
    const [{ data: badges }, { data: earned }] = await Promise.all([
      supabase
        .from("badges")
        .select("id, name, description, criteria_description, icon_url")
        .order("name"),
      supabase.from("user_badges").select("badge_id").limit(20000),
    ]);

    const counts = new Map<string, number>();
    for (const row of earned ?? []) counts.set(row.badge_id, (counts.get(row.badge_id) ?? 0) + 1);

    return (badges ?? []).map((b) => ({ ...b, earned_count: counts.get(b.id) ?? 0 }));
  },
);

/** The signed-in user's earned badges, keyed by badge_id -> awarded_at. */
export const getMyEarnedBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ earned: Record<string, string> }> => {
    const { data } = await context.supabase
      .from("user_badges")
      .select("badge_id, awarded_at")
      .eq("user_id", context.userId);

    const earned: Record<string, string> = {};
    for (const row of data ?? []) earned[row.badge_id] = row.awarded_at;
    return { earned };
  });
