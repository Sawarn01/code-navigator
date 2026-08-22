import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { CheckCircle2, Search } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { DifficultyBadge } from "@/components/practice/DifficultyBadge";
import { ProblemWorkspace } from "@/components/practice/ProblemWorkspace";
import { getPracticeCatalog, getSolvedQuestions } from "@/lib/practice.functions";
import { useAuth } from "@/hooks/useAuth";

const catalogQuery = queryOptions({
  queryKey: ["practice-catalog"],
  queryFn: () => getPracticeCatalog(),
});

export const Route = createFileRoute("/practice")({
  validateSearch: (search: Record<string, unknown>) => ({
    lang: typeof search["lang"] === "string" ? (search["lang"] as string) : "all",
    q: typeof search["q"] === "string" ? (search["q"] as string) : "",
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  head: () => ({
    meta: [
      { title: "Practice Problems — Space" },
      {
        name: "description",
        content:
          "Solve 120+ graded coding problems across JavaScript, Python, Java, C++, C, TypeScript, Go and SQL with instant test feedback.",
      },
      { property: "og:title", content: "Practice Problems — Space" },
      {
        property: "og:description",
        content: "Graded interview-style problems with hidden test cases and instant execution.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center text-sm text-muted-foreground">
      Could not load practice problems. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Page not found.
    </div>
  ),
  component: PracticePage,
});

const DIFFICULTIES = ["all", "easy", "medium", "hard"] as const;

function PracticePage() {
  const { data } = useSuspenseQuery(catalogQuery);
  const { isAuthenticated } = useAuth();
  const fetchSolved = useServerFn(getSolvedQuestions);
  const { data: solvedData } = useQuery({
    queryKey: ["solved"],
    queryFn: () => fetchSolved(),
    enabled: isAuthenticated,
  });
  const solved = useMemo(() => new Set(solvedData?.solved ?? []), [solvedData]);

  const initial = Route.useSearch();
  const [language, setLanguage] = useState(initial.lang || "all");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("all");
  const [status, setStatus] = useState<"all" | "solved" | "unsolved">("all");
  const [search, setSearch] = useState(initial.q ?? "");

  const filtered = useMemo(() => {
    const langId = data.languages.find((l) => l.slug === language)?.id;
    return data.questions.filter((q) => {
      if (language !== "all" && q.language_id !== langId) return false;
      if (difficulty !== "all" && q.difficulty !== difficulty) return false;
      if (status === "solved" && !solved.has(q.id)) return false;
      if (status === "unsolved" && solved.has(q.id)) return false;
      if (search && !q.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, language, difficulty, status, search, solved]);

  const [selected, setSelected] = useState<string | null>(null);
  const activeSlug = selected ?? filtered[0]?.slug ?? null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-indigo-900">Practice</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.questions.length} graded problems. Run against samples, submit for points.
          </p>
        </motion.div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search problems"
                className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {["all", ...data.languages.map((l) => l.slug)].map((slug) => (
                <motion.button
                  key={slug}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setLanguage(slug)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                    language === slug
                      ? "bg-primary text-primary-foreground"
                      : "surface-tint text-indigo-700 hover:bg-indigo-100"
                  }`}
                >
                  {slug === "all"
                    ? "All languages"
                    : (data.languages.find((l) => l.slug === slug)?.name ?? slug)}
                </motion.button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                    difficulty === d ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-border text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
              {(["all", "solved", "unsolved"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                    status === s ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-border text-muted-foreground"
                  }`}
                >
                  {s === "all" ? "Any status" : s}
                </button>
              ))}
            </div>

            <ul className="mt-4 max-h-[60vh] space-y-1.5 overflow-auto pr-1">
              {filtered.map((q, i) => (
                <motion.li
                  key={q.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.02 }}
                >
                  <button
                    onClick={() => setSelected(q.slug)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      activeSlug === q.slug
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-transparent hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-indigo-900">{q.title}</span>
                      {solved.has(q.id) && <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <DifficultyBadge difficulty={q.difficulty} points={q.points} />
                      <span className="text-[11px] uppercase text-muted-foreground">
                        {data.languages.find((l) => l.id === q.language_id)?.name}
                      </span>
                    </div>
                  </button>
                </motion.li>
              ))}
              {filtered.length === 0 && (
                <li className="py-8 text-center text-sm text-muted-foreground">No problems match.</li>
              )}
            </ul>
          </aside>

          <section>
            {activeSlug ? (
              <ProblemWorkspace slug={activeSlug} languages={data.languages} mode="practice" />
            ) : (
              <div className="grid h-64 place-items-center text-sm text-muted-foreground">
                Pick a problem from the list.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
