import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTodayChallenge = createServerFn({ method: "GET" }).handler(async () => {
  const { ensureTodayChallenge } = await import("@/lib/daily-challenge.server");
  return ensureTodayChallenge();
});

export const getMyDailyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ completedToday: boolean; streak: number }> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("daily_streak_count, daily_streak_last_date")
      .eq("id", context.userId)
      .maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    return {
      completedToday: profile?.daily_streak_last_date === today,
      streak: profile?.daily_streak_count ?? 0,
    };
  });
