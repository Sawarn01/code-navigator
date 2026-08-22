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
      const passed =
        exec.status === "success" && normalize(exec.stdout) === normalize(t.expected_output ?? "");
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
  testsPassed: number;
  testsTotal: number;
}) {
  const { userId, question, languageSlug, code, accepted, runtimeMs, testsPassed, testsTotal } =
    params;

  const { data: prior } = await supabaseAdmin
    .from("submissions")
    .select("id")
    .eq("user_id", userId)
    .eq("question_id", question.id)
    .eq("status", "accepted")
    .limit(1);

  const firstSolve = accepted && (prior ?? []).length === 0;
  const hintPenalty = firstSolve ? await hintPenaltyFor(userId, question.id) : 0;
  const pointsAwarded = firstSolve ? Math.max(question.points - hintPenalty, 0) : 0;
  // Informational only — points above stay binary (first full-pass solve).
  const score = testsTotal > 0 ? Math.round((testsPassed / testsTotal) * 10000) / 100 : null;

  const { data: inserted, error } = await supabaseAdmin
    .from("submissions")
    .insert({
      user_id: userId,
      question_id: question.id,
      code,
      language: languageSlug,
      status: accepted ? "accepted" : "wrong_answer",
      runtime_ms: runtimeMs,
      points_awarded: pointsAwarded,
      is_first_solve: firstSolve,
      test_cases_passed: testsPassed,
      test_cases_total: testsTotal,
      score,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  let newRating: number | null = null;
  if (firstSolve && question.category === "cp") {
    const { data: rating } = await supabaseAdmin.rpc("apply_cp_rating_update", {
      _user_id: userId,
      _question_id: question.id,
      _submission_id: inserted.id,
    });
    newRating = (rating as number | null) ?? null;
  }

  let dailyChallengeCompleted = false;
  if (accepted) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: daily } = await supabaseAdmin
      .from("daily_challenges")
      .select("id")
      .eq("challenge_date", today)
      .eq("question_id", question.id)
      .maybeSingle();
    if (daily) {
      const { error: completionError } = await supabaseAdmin
        .from("daily_challenge_completions")
        .insert({ user_id: userId, daily_challenge_id: daily.id, submission_id: inserted.id });
      if (completionError && !completionError.message.toLowerCase().includes("duplicate")) {
        throw new Error(completionError.message);
      }
      dailyChallengeCompleted = true;
    }
  }

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

  return {
    firstSolve,
    pointsAwarded,
    newBadges,
    testCasesPassed: testsPassed,
    testCasesTotal: testsTotal,
    score,
    newRating,
    dailyChallengeCompleted,
  };
}

/** Sum of point penalties for hints this user has already revealed on this question. */
async function hintPenaltyFor(userId: string, questionId: string): Promise<number> {
  const { data: hints } = await supabaseAdmin
    .from("question_hints")
    .select("id, points_penalty")
    .eq("question_id", questionId);
  if (!hints?.length) return 0;

  const hintIds = hints.map((h) => h.id);
  const { data: reveals } = await supabaseAdmin
    .from("question_hint_reveals")
    .select("hint_id")
    .eq("user_id", userId)
    .in("hint_id", hintIds);

  const revealedIds = new Set((reveals ?? []).map((r) => r.hint_id));
  return hints.filter((h) => revealedIds.has(h.id)).reduce((sum, h) => sum + h.points_penalty, 0);
}

/** Run arbitrary code against ad-hoc test cases (used by the admin question builder preview). */
export async function runAdHoc(params: {
  languageSlug: string;
  code: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  sqlSetup: string | null;
  tests: { input: string | null; expected_output: string | null }[];
}): Promise<RunOutcome> {
  const { languageSlug, code, timeLimitMs, memoryLimitMb, sqlSetup, tests } = params;
  try {
    const pseudo: QuestionRow = {
      id: "preview",
      title: "preview",
      difficulty: "easy",
      category: "practice",
      points: 0,
      language_id: null,
      time_limit_ms: timeLimitMs,
      memory_limit_mb: memoryLimitMb,
      sql_setup: sqlSetup,
    };
    const { pistonLanguage, pistonVersion, source } = await buildExecution(
      pseudo,
      languageSlug,
      code,
    );
    const results: TestResult[] = [];
    let index = 0;
    for (const t of tests) {
      const exec = await executeOnPiston({
        pistonLanguage,
        pistonVersion,
        source,
        stdin: t.input ?? "",
        timeoutMs: timeLimitMs,
        memoryMb: memoryLimitMb,
      });
      const passed =
        exec.status === "success" && normalize(exec.stdout) === normalize(t.expected_output ?? "");
      results.push({
        index: index++,
        passed,
        isSample: true,
        input: t.input ?? "",
        expected: t.expected_output ?? "",
        actual: exec.stdout,
        stderr: exec.stderr.slice(0, 2000),
        status: exec.status,
        timeMs: exec.time,
        memoryKb: exec.memory ? Math.round(exec.memory / 1024) : null,
      });
    }
    return { ok: true, results, allPassed: results.length > 0 && results.every((r) => r.passed) };
  } catch (e) {
    if (e instanceof ExecutionServiceError) {
      return { ok: false, error: "service_unavailable", message: e.message };
    }
    throw e;
  }
}
