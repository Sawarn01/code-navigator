import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { CheckCircle2, Search } from "lucide-react";
import { DifficultyBadge } from "@/components/practice/DifficultyBadge";
import { ProblemWorkspace } from "@/components/practice/ProblemWorkspace";
import { getSolvedQuestions } from "@/lib/practice.functions";
import { useAuth } from "@/hooks/useAuth";

export type ExplorerLanguage = { id: string; slug: string; name: string };
export type ExplorerQuestion = {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  points: number;
  language_id: string | null;
};
export type ExplorerTopic = { id: string; name: string; slug: string; count: number };

const DIFFICULTIES = ["all", "easy", "medium", "hard"] as const;

export function PracticeExplorer({
  languages,
  questions,
  topics,
  questionTopics,
  initialLanguage = "all",
  initialSearch = "",
  lockedTopic,
  mode = "practice",
}: {
  languages: ExplorerLanguage[];
  questions: ExplorerQuestion[];
  topics: ExplorerTopic[];
  questionTopics: Record<string, string[]>;
  initialLanguage?: string;
  initialSearch?: string;
  lockedTopic?: string;
  mode?: "practice" | "cp";
}) {
  const { isAuthenticated } = useAuth();
  const fetchSolved = useServerFn(getSolvedQuestions);
  const { data: solvedData } = useQuery({
    queryKey: ["solved"],
    queryFn: () => fetchSolved(),
    enabled: isAuthenticated,
  });
  const solved = useMemo(() => new Set(solvedData?.solved ?? []), [solvedData]);

  const [language, setLanguage] = useState(initialLanguage || "all");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("all");
  const [status, setStatus] = useState<"all" | "solved" | "unsolved">("all");
  const [topic, setTopic] = useState<string>("all");
  const [search, setSearch] = useState(initialSearch ?? "");

  const filtered = useMemo(() => {
    const langId = languages.find((l) => l.slug === language)?.id;
    return questions.filter((q) => {
      const qTopics = questionTopics[q.id] ?? [];
      if (lockedTopic && !qTopics.includes(lockedTopic)) return false;
      if (!lockedTopic && topic !== "all" && !qTopics.includes(topic)) return false;
      if (language !== "all" && q.language_id !== langId) return false;
      if (difficulty !== "all" && q.difficulty !== difficulty) return false;
      if (status === "solved" && !solved.has(q.id)) return false;
      if (status === "unsolved" && solved.has(q.id)) return false;
      if (search && !q.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [
    languages,
    questions,
    questionTopics,
    lockedTopic,
    topic,
    language,
    difficulty,
    status,
    search,
    solved,
  ]);

  const [selected, setSelected] = useState<string | null>(null);
  const activeSlug =
    selected && filtered.some((q) => q.slug === selected) ? selected : (filtered[0]?.slug ?? null);

  return (
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

        {!lockedTopic && topics.length > 0 && (
          <label className="mt-3 block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Topic
            </span>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All topics</option>
              {topics
                .filter((t) => t.count > 0)
                .map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name} ({t.count})
                  </option>
                ))}
            </select>
          </label>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {["all", ...languages.map((l) => l.slug)].map((slug) => (
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
                : (languages.find((l) => l.slug === slug)?.name ?? slug)}
            </motion.button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                difficulty === d
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-border text-muted-foreground"
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
                status === s
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-border text-muted-foreground"
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
                  {solved.has(q.id) && (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <DifficultyBadge difficulty={q.difficulty} points={q.points} />
                  <span className="text-[11px] uppercase text-muted-foreground">
                    {languages.find((l) => l.id === q.language_id)?.name}
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
          <ProblemWorkspace slug={activeSlug} languages={languages} mode={mode} />
        ) : (
          <div className="grid h-64 place-items-center text-sm text-muted-foreground">
            Pick a problem from the list.
          </div>
        )}
      </section>
    </div>
  );
}
