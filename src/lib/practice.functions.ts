import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPracticeCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchLanguages, fetchQuestions } = await import("@/lib/practice.server");
  const [languages, questions] = await Promise.all([fetchLanguages(), fetchQuestions("practice")]);
  return { languages, questions };
});

export const getCpCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchLanguages, fetchQuestions } = await import("@/lib/practice.server");
  const [languages, questions] = await Promise.all([fetchLanguages(), fetchQuestions("cp")]);
  return { languages, questions };
});

export const getQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug) }))
  .handler(async ({ data }) => {
    const { fetchQuestionDetail } = await import("@/lib/practice.server");
    return fetchQuestionDetail(data.slug);
  });

export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((input: { period?: "all" | "month" | "week" }) => ({
    period: (input?.period ?? "all") as "all" | "month" | "week",
  }))
  .handler(async ({ data }) => {
    const { fetchLeaderboard } = await import("@/lib/practice.server");
    return { period: data.period, rows: await fetchLeaderboard(data.period) };
  });

export const getSolvedQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { fetchSolvedIds } = await import("@/lib/practice.server");
    return { solved: await fetchSolvedIds(context.userId) };
  });
