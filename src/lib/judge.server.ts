import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ExecutionServiceError, executeOnPiston, sqlHarness } from "./piston.server";

export type TestResult = {
  index: number;
  passed: boolean;
  isSample: boolean;
  input: string | null;
  expected: string | null;
  actual: string;
  stderr: string;
  status: string;
  timeMs: number | null;
  memoryKb: number | null;
};

export type RunOutcome =
  | { ok: true; results: TestResult[]; allPassed: boolean }
  | { ok: false; error: "service_unavailable"; message: string };

export type QuestionRow = {
  id: string;
  title: string;
  difficulty: string;
  category: string;
  points: number;
  language_id: string | null;
  time_limit_ms: number;
  memory_limit_mb: number;
  sql_setup: string | null;
};

function normalize(out: string): string {
  return out
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "")
    .trim();
}

export async function loadQuestion(questionId: string): Promise<QuestionRow> {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select(
      "id, title, difficulty, category, points, language_id, time_limit_ms, memory_limit_mb, sql_setup",
    )
    .eq("id", questionId)
    .maybeSingle();
  if (error || !data) throw new Error("Question not found");
  return data as QuestionRow;
}

export async function loadTests(questionId: string, samplesOnly: boolean) {
  let query = supabaseAdmin
    .from("test_cases")
    .select("id, input, expected_output, is_sample")
    .eq("question_id", questionId);
  if (samplesOnly) query = query.eq("is_sample", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function resolveRuntime(languageSlug: string) {
  const { data } = await supabaseAdmin
    .from("languages")
    .select("slug, name, piston_language, piston_version")
    .eq("slug", languageSlug)
    .maybeSingle();
  if (!data) throw new Error(`Unknown language: ${languageSlug}`);
  if (!data.piston_version) {
    throw new ExecutionServiceError(
      `No Piston runtime version configured for ${data.name}. Set it in the admin panel.`,
    );
  }
  return {
    pistonLanguage: data.piston_language ?? data.slug,
    pistonVersion: data.piston_version,
  };
}

/** SQL questions are executed as a Python + sqlite3 harness. */
async function buildExecution(question: QuestionRow, languageSlug: string, code: string) {
  if (languageSlug === "sql") {
    const runtime = await resolveRuntime("python");
    return { ...runtime, source: sqlHarness(question.sql_setup ?? "", code) };
  }
  const runtime = await resolveRuntime(languageSlug);
  return { ...runtime, source: code };
}

export async function runAgainstTests(params: {
  question: QuestionRow;
  languageSlug: string;
  code: string;
  samplesOnly: boolean;
}): Promise<RunOutcome> {
  const { question, languageSlug, code, samplesOnly } = params;
  try {
    const [{ pistonLanguage, pistonVersion, source }, tests] = await Promise.all([
      buildExecution(question, languageSlug, code),
      loadTests(question.id, samplesOnly),
    ]);

    if (tests.length === 0) {
      return { ok: true, results: [], allPassed: false };
    }

    const results: TestResult[] = [];
    let index = 0;
    for (const t of tests) {
      const exec = await executeOnPiston({
        pistonLanguage,
        pistonVersion,
        source,
        stdin: t.input ?? "",
        timeoutMs: question.time_limit_ms,
        memoryMb: question.memory_limit_mb,
      });
      const passed = exec.status === "success" && normalize(exec.stdout) === normalize(t.expected_output ?? "");
      results.push({
        index: index++,
        passed,
        isSample: t.is_sample,
        input: t.is_sample ? (t.input ?? "") : null,
        expected: t.is_sample ? (t.expected_output ?? "") : null,
        actual: t.is_sample ? exec.stdout : passed ? "" : "(hidden)",
        stderr: exec.stderr.slice(0, 2000),
        status: exec.status,
        timeMs: exec.time,
        memoryKb: exec.memory ? Math.round(exec.memory / 1024) : null,
      });
    }
    return { ok: true, results, allPassed: results.every((r) => r.passed) };
  } catch (e) {
    if (e instanceof ExecutionServiceError) {
      return { ok: false, error: "service_unavailable", message: e.message };
    }
    throw e;
  }
}

export async function recordSubmission(params: {
  userId: string;
  question: QuestionRow;
  languageSlug: string;
  code: string;
  accepted: boolean;
  runtimeMs: number | null;
}) {
  const { userId, question, languageSlug, code, accepted, runtimeMs } = params;

  const { data: prior } = await supabaseAdmin
    .from("submissions")
    .select("id")
    .eq("user_id", userId)
    .eq("question_id", question.id)
    .eq("status", "accepted")
    .limit(1);

  const firstSolve = accepted && (prior ?? []).length === 0;
  const pointsAwarded = firstSolve ? question.points : 0;

  const { error } = await supabaseAdmin.from("submissions").insert({
    user_id: userId,
    question_id: question.id,
    code,
    language: languageSlug,
    status: accepted ? "accepted" : "wrong_answer",
    runtime_ms: runtimeMs,
    points_awarded: pointsAwarded,
    is_first_solve: firstSolve,
  });
  if (error) throw new Error(error.message);

  let newBadges: string[] = [];
  if (pointsAwarded > 0) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("points")
      .eq("id", userId)
      .maybeSingle();
    await supabaseAdmin
      .from("profiles")
      .update({ points: (profile?.points ?? 0) + pointsAwarded })
      .eq("id", userId);
  }

  const { data: badges } = await supabaseAdmin
    .from("user_badges")
    .select("awarded_at, badges(name)")
    .eq("user_id", userId)
    .gte("awarded_at", new Date(Date.now() - 60_000).toISOString());
  newBadges = (badges ?? [])
    .map((b) => (b as unknown as { badges?: { name?: string } }).badges?.name)
    .filter((n): n is string => !!n);

  return { firstSolve, pointsAwarded, newBadges };
}
