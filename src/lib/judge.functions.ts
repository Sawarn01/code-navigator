import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const runCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { questionId: string; language: string; code: string }) => ({
    questionId: String(input.questionId),
    language: String(input.language),
    code: String(input.code ?? "").slice(0, 60000),
  }))
  .handler(async ({ data }) => {
    const { loadQuestion, runAgainstTests } = await import("@/lib/judge.server");
    const question = await loadQuestion(data.questionId);
    const outcome = await runAgainstTests({
      question,
      languageSlug: data.language,
      code: data.code,
      samplesOnly: true,
    });
    return outcome;
  });

export const submitSolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { questionId: string; language: string; code: string }) => ({
    questionId: String(input.questionId),
    language: String(input.language),
    code: String(input.code ?? "").slice(0, 60000),
  }))
  .handler(async ({ data, context }) => {
    const { loadQuestion, runAgainstTests, recordSubmission } = await import("@/lib/judge.server");
    const question = await loadQuestion(data.questionId);
    const outcome = await runAgainstTests({
      question,
      languageSlug: data.language,
      code: data.code,
      samplesOnly: false,
    });
    if (!outcome.ok) return { ...outcome, graded: false as const };

    const runtimeMs = outcome.results.reduce((acc, r) => acc + (r.timeMs ?? 0), 0);
    const record = await recordSubmission({
      userId: context.userId,
      question,
      languageSlug: data.language,
      code: data.code,
      accepted: outcome.allPassed,
      runtimeMs: Math.round(runtimeMs),
    });

    return { ...outcome, graded: true as const, ...record, questionPoints: question.points };
  });
