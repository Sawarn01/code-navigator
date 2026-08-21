import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Swords, Timer } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { DifficultyBadge } from "@/components/practice/DifficultyBadge";
import { ProblemWorkspace } from "@/components/practice/ProblemWorkspace";
import { getCpCatalog } from "@/lib/practice.functions";

const cpQuery = queryOptions({ queryKey: ["cp-catalog"], queryFn: () => getCpCatalog() });

export const Route = createFileRoute("/cp-zone")({
  loader: ({ context }) => context.queryClient.ensureQueryData(cpQuery),
  head: () => ({
    meta: [
      { title: "CP Zone — Contest Mode | Space" },
      {
        name: "description",
        content:
          "ICPC-style competitive programming problems with strict time and memory limits, hidden tests and a live contest timer.",
      },
      { property: "og:title", content: "CP Zone — Contest Mode | Space" },
      {
        property: "og:description",
        content: "Timed, ICPC-flavoured algorithmic problems: graphs, DP, greedy, number theory.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center text-sm text-muted-foreground">
      Could not load the CP Zone. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Page not found.
    </div>
  ),
  component: CpZone,
});

const SESSIONS = [
  { label: "30 min sprint", seconds: 30 * 60 },
  { label: "60 min round", seconds: 60 * 60 },
  { label: "120 min contest", seconds: 120 * 60 },
];

function CpZone() {
  const { data } = useSuspenseQuery(cpQuery);
  const [selected, setSelected] = useState<string | null>(null);
  const [session, setSession] = useState<number | null>(null);

  const problems = useMemo(
    () => [...data.questions].sort((a, b) => a.points - b.points || a.title.localeCompare(b.title)),
    [data.questions],
  );
  const activeSlug = selected ?? problems[0]?.slug ?? null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-indigo-200 bg-indigo-950 p-6 text-indigo-50"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
                <Swords className="size-6" /> CP Zone
              </h1>
              <p className="mt-1 text-sm text-indigo-200">
                Contest mode: strict limits, hidden tests only, no partial credit.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {SESSIONS.map((s) => (
                <motion.button
                  key={s.seconds}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSession(session === s.seconds ? null : s.seconds)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    session === s.seconds
                      ? "bg-indigo-50 text-indigo-900"
                      : "border border-indigo-700 text-indigo-100 hover:bg-indigo-900"
                  }`}
                >
                  <Timer className="size-3.5" />
                  {s.label}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-soft)]">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Problem set
            </p>
            <ul className="mt-2 space-y-1.5">
              {problems.map((q, i) => (
                <motion.li key={q.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <button
                    onClick={() => setSelected(q.slug)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      activeSlug === q.slug ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-indigo-900">{q.title}</span>
                      {q.tier && (
                        <span className="shrink-0 rounded-full surface-tint px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          {q.tier}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <DifficultyBadge difficulty={q.difficulty} points={q.points} />
                    </div>
                  </button>
                </motion.li>
              ))}
            </ul>
          </aside>

          <section>
            {activeSlug ? (
              <ProblemWorkspace
                slug={activeSlug}
                languages={data.languages}
                mode="cp"
                contestSeconds={session ?? undefined}
              />
            ) : (
              <div className="grid h-64 place-items-center text-sm text-muted-foreground">
                No contest problems yet.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
