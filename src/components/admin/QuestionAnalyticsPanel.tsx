import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { getQuestionAnalytics, type QuestionAnalytics } from "@/lib/analytics.functions";

const FLAG_COPY: Record<string, string> = {
  "low-pass": "Unusually low pass rate — possibly broken tests or mislabeled difficulty",
  "easy-hard": "Very high pass rate for a hard problem — difficulty may be mislabeled",
};

export function QuestionAnalyticsPanel() {
  const fetchStats = useServerFn(getQuestionAnalytics);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [difficulty, setDifficulty] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["question-analytics"],
    queryFn: () => fetchStats(),
    retry: false,
  });

  const rows: QuestionAnalytics[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (r) =>
        (!onlyFlagged || r.flag) &&
        (difficulty === "all" || r.difficulty === difficulty) &&
        (!q || r.title.toLowerCase().includes(q)),
    );
  }, [data, onlyFlagged, difficulty, search]);

  const flaggedCount = (data ?? []).filter((r) => r.flag).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-indigo-900">Question analytics</h2>
          <p className="text-xs text-muted-foreground">
            Attempts, pass rate, attempts-to-solve and runtime per problem.
            {flaggedCount > 0 && (
              <span className="ml-1 font-semibold text-indigo-700">{flaggedCount} flagged</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search problems…"
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
          />
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-indigo-700"
          >
            <option value="all">All difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => setOnlyFlagged((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
              onlyFlagged
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-input text-muted-foreground hover:bg-accent"
            }`}
          >
            Flagged only
          </motion.button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-destructive">Admin role required.</p>
      ) : isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading question stats…</p>
      ) : (
        <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-border">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="sticky top-0 bg-indigo-50/80 backdrop-blur">
              <tr className="text-xs uppercase tracking-wide text-indigo-700">
                <th className="px-3 py-2.5 font-semibold">Problem</th>
                <th className="px-3 py-2.5 font-semibold">Difficulty</th>
                <th className="px-3 py-2.5 font-semibold">Attempts</th>
                <th className="px-3 py-2.5 font-semibold">Solvers</th>
                <th className="px-3 py-2.5 font-semibold">Pass rate</th>
                <th className="px-3 py-2.5 font-semibold">Avg tries</th>
                <th className="px-3 py-2.5 font-semibold">Avg runtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {rows.map((r) => (
                  <motion.tr
                    key={r.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="transition-colors hover:bg-indigo-50/50"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-indigo-900">{r.title}</span>
                        {r.flag && (
                          <span
                            title={FLAG_COPY[r.flag]}
                            className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700"
                          >
                            {r.flag === "low-pass" ? "Low pass" : "Too easy?"}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {r.language ?? "General"} · {r.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 capitalize text-muted-foreground">{r.difficulty}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.attempts}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.solvers}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-indigo-100">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${Math.min(100, r.passRate)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-indigo-700">
                          {r.passRate.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {r.avgAttemptsToSolve ? r.avgAttemptsToSolve.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {r.avgRuntimeMs != null ? `${r.avgRuntimeMs} ms` : "—"}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No questions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
