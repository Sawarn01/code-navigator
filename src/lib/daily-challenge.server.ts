import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TodayChallenge = {
  challengeId: string;
  challengeDate: string;
  slug: string;
  title: string;
  difficulty: string;
  points: number;
};

/**
 * Returns today's (UTC) featured question, creating one deterministically
 * from the date if nobody has curated one yet — so the feature works without
 * requiring daily admin upkeep. A concurrent first request race is handled
 * by re-reading on insert conflict rather than erroring.
 */
export async function ensureTodayChallenge(): Promise<TodayChallenge | null> {
  const today = new Date().toISOString().slice(0, 10);

  const existing = await loadChallenge(today);
  if (existing) return existing;

  const { data: eligible } = await supabaseAdmin
    .from("questions")
    .select("id")
    .eq("category", "practice")
    .eq("is_archived", false)
    .order("id");
  if (!eligible?.length) return null;

  const seed = Number(today.replace(/-/g, ""));
  const questionId = eligible[seed % eligible.length]!.id;

  const { error } = await supabaseAdmin
    .from("daily_challenges")
    .insert({ challenge_date: today, question_id: questionId });
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw new Error(error.message);
  }

  return loadChallenge(today);
}

async function loadChallenge(challengeDate: string): Promise<TodayChallenge | null> {
  const { data } = await supabaseAdmin
    .from("daily_challenges")
    .select("id, challenge_date, questions(slug, title, difficulty, points)")
    .eq("challenge_date", challengeDate)
    .maybeSingle();
  if (!data) return null;
  const q = data.questions as {
    slug: string;
    title: string;
    difficulty: string;
    points: number;
  } | null;
  if (!q) return null;
  return {
    challengeId: data.id,
    challengeDate: data.challenge_date,
    slug: q.slug,
    title: q.title,
    difficulty: q.difficulty,
    points: q.points,
  };
}
