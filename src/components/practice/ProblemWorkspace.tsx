import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, Loader2, Play, ServerCrash, Send, Timer } from "lucide-react";
import { toast } from "sonner";
import { CodeEditor } from "@/components/CodeEditor";
import { DifficultyBadge } from "@/components/practice/DifficultyBadge";
import { Markdown } from "@/lib/markdown";
import { getQuestion } from "@/lib/practice.functions";
import { runCode, submitSolution } from "@/lib/judge.functions";
import { useAuth } from "@/hooks/useAuth";

type Language = { id: string; slug: string; name: string };

type TestResult = {
  index: number;
  passed: boolean;
  isSample: boolean;
  input: string | null;
  expected: string | null;
  actual: string;
  stderr: string;
  status: string;
  timeMs: number | null;
};

type Outcome =
  | { ok: true; results: TestResult[]; allPassed: boolean; graded?: boolean; pointsAwarded?: number }
  | { ok: false; error: "service_unavailable"; message: string };

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        x: (i - 9) * 14,
        delay: i * 0.02,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 1, y: 0, x: 0, scale: 0.6 }}
          animate={{ opacity: 0, y: -120 - Math.abs(p.x), x: p.x * 2, scale: 1.1, rotate: p.x }}
          transition={{ duration: 1.1, delay: p.delay, ease: "easeOut" }}
          className="absolute size-2 rounded-sm bg-primary"
        />
      ))}
    </div>
  );
}

function CountdownTimer({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [seconds]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ${
        left <= 60 ? "bg-rose-50 text-rose-700" : "surface-tint text-indigo-700"
      }`}
    >
      <Timer className="size-4" />
      {mm}:{ss}
    </span>
  );
}

export function ProblemWorkspace({
  slug,
  languages,
  mode,
  contestSeconds,
}: {
  slug: string;
  languages: Language[];
  mode: "practice" | "cp";
  contestSeconds?: number | undefined;
}) {
  const { isAuthenticated } = useAuth();
  const fetchQuestion = useServerFn(getQuestion);
  const doRun = useServerFn(runCode);
  const doSubmit = useServerFn(submitSolution);

  const { data: question, isLoading } = useQuery({
    queryKey: ["question", slug],
    queryFn: () => fetchQuestion({ data: { slug } }),
  });

  const [language, setLanguage] = useState<string>("python");
  const [code, setCode] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const questionLanguage = useMemo(
    () => languages.find((l) => l.id === question?.language_id)?.slug ?? null,
    [languages, question?.language_id],
  );

  useEffect(() => {
    if (!question) return;
    setOutcome(null);
    const lang = questionLanguage ?? "python";
    setLanguage(lang);
    setCode(question.starter_code ?? "");
  }, [question, questionLanguage]);

  const runMutation = useMutation({
    mutationFn: () => doRun({ data: { questionId: question!.id, language, code } }),
    onSuccess: (res) => setOutcome(res as Outcome),
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: () => doSubmit({ data: { questionId: question!.id, language, code } }),
    onSuccess: (res) => {
      const r = res as Outcome & { newBadges?: string[] };
      setOutcome(r);
      if (r.ok && r.allPassed) {
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1600);
        toast.success(
          r.pointsAwarded ? `Accepted — +${r.pointsAwarded} points!` : "Accepted! Already solved.",
        );
        (r.newBadges ?? []).forEach((b) => toast(`🏅 Badge unlocked: ${b}`));
      } else if (r.ok) {
        toast.error("Some test cases failed.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="grid h-64 place-items-center text-sm text-muted-foreground">Loading problem…</div>;
  }
  if (!question) {
    return <div className="grid h-64 place-items-center text-sm text-muted-foreground">Select a problem to begin.</div>;
  }

  const isSql = questionLanguage === "sql";
  const busy = runMutation.isPending || submitMutation.isPending;

  return (
    <div className="relative flex h-full flex-col gap-4">
      {celebrate && <Confetti />}

      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-indigo-900">{question.title}</h2>
          <div className="flex items-center gap-2">
            {question.tier && (
              <span className="rounded-full surface-tint px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                {question.tier}
              </span>
            )}
            <DifficultyBadge difficulty={question.difficulty} points={question.points} />
            {mode === "cp" && contestSeconds ? <CountdownTimer seconds={contestSeconds} /> : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Time limit: {(question.time_limit_ms / 1000).toFixed(1)}s</span>
          <span>Memory limit: {question.memory_limit_mb} MB</span>
          {mode === "cp" && <span>Hidden tests only — no partial credit</span>}
        </div>

        <div className="mt-4 max-h-64 overflow-auto pr-1 text-sm">
          <Markdown source={question.description} />
          {question.constraints && (
            <p className="mt-3 rounded-xl surface-tint p-3 text-xs text-indigo-700">
              <strong>Constraints:</strong> {question.constraints}
            </p>
          )}
          {isSql && question.sample_table && (
            <pre className="mt-3 overflow-auto rounded-xl border border-border bg-muted p-3 text-xs">
              {question.sample_table}
            </pre>
          )}
        </div>
      </motion.div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {questionLanguage ? (
            <span className="text-sm font-semibold text-indigo-700">
              {languages.find((l) => l.slug === questionLanguage)?.name}
            </span>
          ) : (
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
            >
              {languages
                .filter((l) => l.slug !== "sql")
                .map((l) => (
                  <option key={l.id} value={l.slug}>
                    {l.name}
                  </option>
                ))}
            </select>
          )}

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={busy}
                  onClick={() => runMutation.mutate()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-input px-3 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50"
                >
                  {runMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Run
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={busy}
                  onClick={() => submitMutation.mutate()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Submit
                </motion.button>
              </>
            ) : (
              <Link
                to="/auth"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Sign in to run code
              </Link>
            )}
          </div>
        </div>

        <CodeEditor value={code} onChange={setCode} language={language} height="300px" />
      </div>

      <AnimatePresence mode="wait">
        {outcome && (
          <motion.div
            key={JSON.stringify(outcome).slice(0, 40)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
          >
            {!outcome.ok ? (
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-amber-800">
                <ServerCrash className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Execution service unavailable</p>
                  <p className="text-xs">{outcome.message} Your attempt was not graded.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2">
                  {outcome.allPassed ? (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  ) : (
                    <CircleAlert className="size-5 text-rose-600" />
                  )}
                  <p className="text-sm font-semibold">
                    {outcome.results.filter((r) => r.passed).length} / {outcome.results.length} test
                    cases passed
                  </p>
                </div>
                <ul className="space-y-2">
                  {outcome.results.map((r) => (
                    <motion.li
                      key={r.index}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: r.index * 0.04 }}
                      className={`rounded-xl border p-3 text-xs ${
                        r.passed ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>
                          Test {r.index + 1} {r.isSample ? "(sample)" : "(hidden)"} —{" "}
                          {r.passed ? "Passed" : r.status === "success" ? "Wrong answer" : r.status}
                        </span>
                        {r.timeMs != null && <span className="opacity-70">{r.timeMs} ms</span>}
                      </div>
                      {r.isSample && !r.passed && (
                        <div className="mt-2 grid gap-1 font-mono">
                          <span>input: {r.input}</span>
                          <span>expected: {r.expected}</span>
                          <span>got: {r.actual || "(empty)"}</span>
                        </div>
                      )}
                      {r.stderr && <pre className="mt-2 overflow-auto font-mono">{r.stderr}</pre>}
                    </motion.li>
                  ))}
                </ul>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
