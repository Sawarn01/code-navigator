import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Flame, LayoutGrid, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PracticeExplorer } from "@/components/practice/PracticeExplorer";
import { DifficultyBadge } from "@/components/practice/DifficultyBadge";
import { getPracticeCatalog } from "@/lib/practice.functions";
import { getTodayChallenge, getMyDailyStatus } from "@/lib/daily-challenge.functions";
import { useAuth } from "@/hooks/useAuth";

const catalogQuery = queryOptions({
  queryKey: ["practice-catalog"],
  queryFn: () => getPracticeCatalog(),
});

export const Route = createFileRoute("/practice/")({
  validateSearch: (search: Record<string, unknown>) => ({
    lang: typeof search["lang"] === "string" ? (search["lang"] as string) : "all",
    q: typeof search["q"] === "string" ? (search["q"] as string) : "",
    slug: typeof search["slug"] === "string" ? (search["slug"] as string) : "",
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

function DailyChallengeBanner() {
  const { isAuthenticated } = useAuth();
  const fetchChallenge = useServerFn(getTodayChallenge);
  const { data: challenge } = useQuery({
    queryKey: ["today-challenge"],
    queryFn: () => fetchChallenge(),
  });
  const fetchStatus = useServerFn(getMyDailyStatus);
  const { data: status } = useQuery({
    queryKey: ["my-daily-status"],
    queryFn: () => fetchStatus(),
    enabled: isAuthenticated,
  });

  if (!challenge) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-200 surface-tint p-5"
    >
      <div>
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-indigo-600">
          <Sparkles className="size-3.5" /> Today's challenge
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <h2 className="font-display text-lg font-bold text-indigo-900">{challenge.title}</h2>
          <DifficultyBadge difficulty={challenge.difficulty} points={challenge.points} />
        </div>
        {isAuthenticated && status && status.streak > 0 && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
            <Flame className="size-3.5" /> {status.streak} day daily streak
            {status.completedToday ? " — done for today!" : ""}
          </p>
        )}
      </div>
      <Link
        to="/practice"
        search={{ lang: "all", q: "", slug: challenge.slug }}
        className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02] ${
          status?.completedToday
            ? "border border-indigo-300 bg-background text-indigo-700"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {status?.completedToday ? "Solved — view again" : "Solve today's challenge"}
      </Link>
    </motion.div>
  );
}

function PracticePage() {
  const { data } = useSuspenseQuery(catalogQuery);
  const initial = Route.useSearch();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <h1 className="font-display text-3xl font-bold text-indigo-900">Practice</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.questions.length} graded problems. Run against samples, submit for points.
            </p>
          </div>
          <Link
            to="/practice/topics"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            <LayoutGrid className="size-4" /> Browse by topic
          </Link>
        </motion.div>

        <DailyChallengeBanner />

        <PracticeExplorer
          languages={data.languages}
          questions={data.questions}
          topics={data.topics}
          questionTopics={data.questionTopics}
          initialLanguage={initial.lang}
          initialSearch={initial.q}
          initialSlug={initial.slug || undefined}
        />
      </main>
    </div>
  );
}
