import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PracticeExplorer } from "@/components/practice/PracticeExplorer";
import { TopicIcon } from "@/components/practice/TopicIcon";
import { getPracticeCatalog } from "@/lib/practice.functions";

const catalogQuery = queryOptions({
  queryKey: ["practice-catalog"],
  queryFn: () => getPracticeCatalog(),
});

export const Route = createFileRoute("/practice/topics/$topicSlug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(catalogQuery);
    const topic = data.topics.find((t) => t.slug === params.topicSlug);
    if (!topic) throw notFound();
    return { topicName: topic.name, topicDescription: topic.description };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Topic unavailable — Space" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.topicName} Practice Problems — Space`;
    const description =
      loaderData.topicDescription ??
      `Practice ${loaderData.topicName} problems across every supported language on Space.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Could not load this topic. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      That topic does not exist.
    </div>
  ),
  component: TopicPracticePage,
});

function TopicPracticePage() {
  const { topicSlug } = Route.useParams();
  const { data } = useSuspenseQuery(catalogQuery);
  const topic = data.topics.find((t) => t.slug === topicSlug);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Link
            to="/practice/topics"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="size-3.5" /> All topics
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <TopicIcon name={topic?.icon ?? "Sparkles"} className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-3xl font-bold text-indigo-900">
                {topic?.name ?? topicSlug}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {topic?.count ?? 0} problems across every language.
              </p>
            </div>
          </div>
        </motion.div>

        <PracticeExplorer
          languages={data.languages}
          questions={data.questions}
          topics={data.topics}
          questionTopics={data.questionTopics}
          lockedTopic={topicSlug}
        />
      </main>
    </div>
  );
}
