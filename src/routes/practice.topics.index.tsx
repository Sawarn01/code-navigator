import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { TopicIcon } from "@/components/practice/TopicIcon";
import { getTopics } from "@/lib/topics.functions";

const topicsQuery = queryOptions({
  queryKey: ["topics"],
  queryFn: () => getTopics(),
});

export const Route = createFileRoute("/practice/topics/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(topicsQuery),
  head: () => ({
    meta: [
      { title: "Practice by Topic — Space" },
      {
        name: "description",
        content:
          "Browse coding practice by topic: arrays, dynamic programming, graphs, SQL and more — across every language.",
      },
      { property: "og:title", content: "Practice by Topic — Space" },
      {
        property: "og:description",
        content: "Drill a single algorithmic topic across every supported language.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Could not load topics. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Page not found.
    </div>
  ),
  component: TopicsPage,
});

const SPANS = ["lg:col-span-2", "", "", "lg:col-span-2", "", ""];

function TopicsPage() {
  const { data } = useSuspenseQuery(topicsQuery);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-indigo-900">Practice by topic</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pick a pattern and drill it across every language. Topics are language-independent —
            the same problem may appear in Python, C++ or SQL.
          </p>
        </motion.div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.topics.map((topic, i) => (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: Math.min(i, 10) * 0.03 }}
              whileHover={{ y: -4 }}
              className={SPANS[i % SPANS.length]}
            >
              <Link
                to="/practice/topics/$topicSlug"
                params={{ topicSlug: topic.slug }}
                className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-indigo-300"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                  <TopicIcon name={topic.icon} className="size-5" />
                </span>
                <h2 className="mt-3 font-display text-lg font-semibold text-indigo-900">
                  {topic.name}
                </h2>
                {topic.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {topic.description}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    {topic.count} {topic.count === 1 ? "question" : "questions"}
                  </span>
                  <ArrowRight className="size-4 text-indigo-400 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
