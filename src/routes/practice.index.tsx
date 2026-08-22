import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PracticeExplorer } from "@/components/practice/PracticeExplorer";
import { getPracticeCatalog } from "@/lib/practice.functions";

const catalogQuery = queryOptions({
  queryKey: ["practice-catalog"],
  queryFn: () => getPracticeCatalog(),
});

export const Route = createFileRoute("/practice/")({
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

        <PracticeExplorer
          languages={data.languages}
          questions={data.questions}
          topics={data.topics}
          questionTopics={data.questionTopics}
          initialLanguage={initial.lang}
          initialSearch={initial.q}
        />
      </main>
    </div>
  );
}
