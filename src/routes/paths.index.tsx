import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Layers, PlayCircle } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { getPaths } from "@/lib/lms.functions";

const pathsQuery = queryOptions({ queryKey: ["paths"], queryFn: () => getPaths() });

export const Route = createFileRoute("/paths/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(pathsQuery),
  head: () => ({
    meta: [
      { title: "Learning Paths — Space" },
      {
        name: "description",
        content:
          "Curated multi-course tracks that take you from language fundamentals to contest-ready problem solving.",
      },
      { property: "og:title", content: "Learning Paths — Space" },
      {
        property: "og:description",
        content: "Follow an ordered track of courses with quizzes and completion certificates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Could not load learning paths. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Page not found.
    </div>
  ),
  component: PathsPage,
});

function PathsPage() {
  const { data: paths } = useSuspenseQuery(pathsQuery);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-display text-3xl font-bold text-indigo-900 sm:text-4xl">Learning paths</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Curated tracks that bundle courses in the right order. Finish every lesson and quiz to earn a
            shareable certificate.
          </p>
        </motion.div>

        <div className="mt-8 grid gap-5 lg:grid-cols-6">
          {paths.map((p, i) => (
            <BentoCard key={p.id} delay={i * 0.06} className={i === 0 ? "lg:col-span-4" : "lg:col-span-2"}>
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl surface-tint text-indigo-700">
                  <Layers className="size-4" />
                </span>
                <h2 className="font-display text-xl font-bold text-indigo-900">{p.title}</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.courses.map((c, ci) => (
                  <span
                    key={c.id}
                    className="rounded-full border border-indigo-100 surface-tint px-3 py-1 text-xs font-semibold text-indigo-700"
                  >
                    {ci + 1}. {c.title}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <PlayCircle className="size-3.5" /> {p.course_count} courses · {p.lesson_count} lessons
                </span>
                <motion.div whileHover={{ x: 3 }}>
                  <Link
                    to="/paths/$pathId"
                    params={{ pathId: p.id }}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline"
                  >
                    Explore track <ArrowRight className="size-4" />
                  </Link>
                </motion.div>
              </div>
            </BentoCard>
          ))}
        </div>
      </main>
    </div>
  );
}
