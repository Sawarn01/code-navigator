import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type QuestionListItem = {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  points: number;
  category: string;
  language_id: string | null;
  tier: string | null;
};

export type QuestionDetail = QuestionListItem & {
  description: string;
  constraints: string | null;
  starter_code: string | null;
  time_limit_ms: number;
  memory_limit_mb: number;
  sql_setup: string | null;
  sample_table: string | null;
  samples: { input: string | null; expected_output: string | null }[];
};

const LIST_COLS = "id, slug, title, difficulty, points, category, language_id, tier";
const DETAIL_COLS = `${LIST_COLS}, description, constraints, starter_code, time_limit_ms, memory_limit_mb, sql_setup, sample_table`;

export async function fetchLanguages() {
  const { data } = await supabaseAdmin
    .from("languages")
    .select("id, name, slug, piston_language, piston_version")
    .order("name");
  return data ?? [];
}

export async function fetchQuestions(category: "practice" | "cp"): Promise<QuestionListItem[]> {
  const { data } = await supabaseAdmin
    .from("questions")
    .select(LIST_COLS)
    .eq("category", category)
    .eq("is_archived", false)
    .order("points")
    .order("title")
    .limit(1000);
  return (data ?? []) as QuestionListItem[];
}

export type TopicSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  count: number;
};

/** Topics plus the question -> topic-slug map, scoped to non-archived questions. */
export async function fetchTopicGraph(category?: "practice" | "cp") {
  const [{ data: topics }, { data: links }] = await Promise.all([
    supabaseAdmin
      .from("topics")
      .select("id, name, slug, description, icon, order_index")
      .order("order_index"),
    supabaseAdmin
      .from("question_topics")
      .select("question_id, topic_id, questions!inner(category, is_archived)")
      .limit(5000),
  ]);

  const visible = (links ?? []).filter((l) => {
    const q = (l as unknown as { questions?: { category: string; is_archived: boolean } }).questions;
    if (!q || q.is_archived) return false;
    return category ? q.category === category : true;
  });

  const slugById = new Map((topics ?? []).map((t) => [t.id, t.slug] as const));
  const questionTopics: Record<string, string[]> = {};
  const counts = new Map<string, number>();
  for (const link of visible) {
    const slug = slugById.get(link.topic_id);
    if (!slug) continue;
    (questionTopics[link.question_id] ??= []).push(slug);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  const summaries: TopicSummary[] = (topics ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    icon: t.icon,
    count: counts.get(t.slug) ?? 0,
  }));

  return { topics: summaries, questionTopics };
}


export async function fetchQuestionDetail(slug: string): Promise<QuestionDetail | null> {
  const { data } = await supabaseAdmin
    .from("questions")
    .select(DETAIL_COLS)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const { data: samples } = await supabaseAdmin
    .from("test_cases")
    .select("input, expected_output")
    .eq("question_id", data.id)
    .eq("is_sample", true);
  return { ...(data as QuestionListItem & QuestionDetail), samples: samples ?? [] };
}

export async function fetchLeaderboard(period: "all" | "month" | "week") {
  const column = period === "week" ? "week_points" : period === "month" ? "month_points" : "points";
  const { data } = await supabaseAdmin
    .from("leaderboard")
    .select("user_id, full_name, avatar_url, points, badge_count, week_points, month_points, solved_count, rank")
    .order(column, { ascending: false })
    .limit(100);
  return (data ?? []).map((row, i) => ({
    ...row,
    displayRank: period === "all" ? row.rank : i + 1,
    periodPoints:
      period === "week" ? row.week_points : period === "month" ? row.month_points : row.points,
  }));
}

export async function fetchSolvedIds(userId: string) {
  const { data } = await supabaseAdmin
    .from("submissions")
    .select("question_id")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .limit(2000);
  return Array.from(new Set((data ?? []).map((s) => s.question_id).filter(Boolean) as string[]));
}
