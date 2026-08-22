import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TopicMasteryRow = {
  topic_id: string;
  topic_name: string;
  topic_slug: string;
  attempted: number;
  solved: number;
  submissions: number;
  pass_rate: number;
};

export type TopicMastery = {
  rows: TopicMasteryRow[];
  strongest: TopicMasteryRow | null;
  weakest: TopicMasteryRow | null;
};

/** Public list of topics with question counts (practice + cp). */
export const getTopics = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchTopicGraph } = await import("@/lib/practice.server");
  const { topics } = await fetchTopicGraph();
  return { topics };
});

export const getMyTopicMastery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TopicMastery> => {
    const { data } = await context.supabase
      .from("user_topic_mastery")
      .select("topic_id, topic_name, topic_slug, attempted, solved, submissions, pass_rate")
      .eq("user_id", context.userId);

    const rows: TopicMasteryRow[] = (data ?? []).map((r) => ({
      topic_id: String(r.topic_id),
      topic_name: String(r.topic_name),
      topic_slug: String(r.topic_slug),
      attempted: Number(r.attempted ?? 0),
      solved: Number(r.solved ?? 0),
      submissions: Number(r.submissions ?? 0),
      pass_rate: Number(r.pass_rate ?? 0),
    })).sort((a, b) => b.pass_rate - a.pass_rate || b.solved - a.solved);

    const engaged = rows.filter((r) => r.attempted > 0);
    return {
      rows,
      strongest: engaged[0] ?? null,
      weakest: engaged.length > 1 ? (engaged[engaged.length - 1] ?? null) : null,
    };
  });

export type Recommendation = {
  slug: string;
  title: string;
  difficulty: string;
  points: number;
  topic: string | null;
  reason: string;
} | null;

/** Next question to solve, weighted toward the user's weakest topic. */
export const getRecommendedQuestion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Recommendation> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: mastery }, { data: solvedRows }] = await Promise.all([
      context.supabase
        .from("user_topic_mastery")
        .select("topic_id, topic_name, attempted, solved, pass_rate")
        .eq("user_id", context.userId),
      context.supabase
        .from("submissions")
        .select("question_id")
        .eq("user_id", context.userId)
        .eq("status", "accepted")
        .limit(2000),
    ]);

    const solved = new Set(
      (solvedRows ?? []).map((s) => s.question_id).filter(Boolean) as string[],
    );

    const ranked = (mastery ?? [])
      .map((m) => ({
        topic_id: String(m.topic_id),
        topic_name: String(m.topic_name),
        pass_rate: Number(m.pass_rate ?? 0),
        solved: Number(m.solved ?? 0),
      }))
      .sort((a, b) => a.pass_rate - b.pass_rate || a.solved - b.solved);

    const weakest = ranked[0] ?? null;

    const { data: candidates } = await supabaseAdmin
      .from("questions")
      .select("id, slug, title, difficulty, points, question_topics(topic_id, topics(name))")
      .eq("category", "practice")
      .eq("is_archived", false)
      .order("points")
      .limit(500);

    const unsolved = (candidates ?? []).filter((q) => !solved.has(q.id));
    if (unsolved.length === 0) return null;

    const topicOf = (q: (typeof unsolved)[number]) => {
      const links = (q as unknown as { question_topics?: { topic_id: string; topics?: { name: string } }[] })
        .question_topics ?? [];
      return links;
    };

    const targeted = weakest
      ? unsolved.find((q) => topicOf(q).some((l) => l.topic_id === weakest.topic_id))
      : undefined;
    const pick = targeted ?? unsolved[0]!;
    const topicName = topicOf(pick)[0]?.topics?.name ?? null;

    return {
      slug: pick.slug,
      title: pick.title,
      difficulty: pick.difficulty,
      points: pick.points,
      topic: targeted && weakest ? weakest.topic_name : topicName,
      reason:
        targeted && weakest
          ? `Your weakest topic right now is ${weakest.topic_name} (${weakest.pass_rate}% pass rate).`
          : "A fresh problem to keep your streak moving.",
    };
  });
