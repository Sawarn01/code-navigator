import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { CheckCircle2, Lock, PlayCircle } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getPath } from "@/lib/lms.functions";
import { getMyCourseProgress } from "@/lib/learn.functions";
import { useAuth } from "@/hooks/useAuth";

const pathQuery = (pathId: string) =>
  queryOptions({
    queryKey: ["path", pathId],
    queryFn: () => getPath({ data: { pathId } }),
  });

export const Route = createFileRoute("/paths/$pathId")({
  loader: async ({ context, params }) => {
    const path = await context.queryClient.ensureQueryData(pathQuery(params.pathId));
    if (!path) throw notFound();
    return { title: path.title, description: path.description };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Path unavailable — Space" }, { name: "robots", content: "noindex" }] };
    }
    const description = loaderData.description ?? "A curated multi-course track on Space.";
    return {
      meta: [
        { title: `${loaderData.title} — Space` },
        { name: "description", content: description.slice(0, 155) },
        { property: "og:title", content: `${loaderData.title} — Space` },
        { property: "og:description", content: description.slice(0, 155) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Could not load this path. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Learning path not found.
    </div>
  ),
  component: PathDetailPage,
});

function PathDetailPage() {
  const { pathId } = Route.useParams();
  const { data: path } = useSuspenseQuery(pathQuery(pathId));
  const { isAuthenticated } = useAuth();
  const fetchProgress = useServerFn(getMyCourseProgress);

  const { data: progress } = useQuery({
    queryKey: ["course-progress"],
    queryFn: () => fetchProgress(),
    enabled: isAuthenticated,
  });

  if (!path) return null;

  const byCourse = progress?.byCourse ?? {};
  const pctFor = (courseId: string, lessons: number) =>
    lessons ? Math.min(100, Math.round(((byCourse[courseId] ?? 0) / lessons) * 100)) : 0;

  const totalLessons = path.courses.reduce((a, c) => a + c.lesson_count, 0);
  const doneLessons = path.courses.reduce((a, c) => a + Math.min(byCourse[c.id] ?? 0, c.lesson_count), 0);
  const overall = totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to="/paths" className="text-xs font-semibold text-indigo-700 hover:underline">
            ← All paths
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo-900">{path.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{path.description}</p>
          {isAuthenticated && (
            <div className="mt-5 max-w-sm">
              <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-50">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overall}%` }}
                  transition={{ duration: 0.7 }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
              <p className="mt-1.5 text-xs font-semibold text-indigo-700">{overall}% of this track complete</p>
            </div>
          )}
        </motion.div>

        <ol className="mt-8 space-y-4">
          {path.courses.map((course, i) => {
            const pct = pctFor(course.id, course.lesson_count);
            const prev = path.courses[i - 1];
            const prevPct = prev ? pctFor(prev.id, prev.lesson_count) : 100;
            const softLocked = isAuthenticated && prevPct < 60;

            return (
              <motion.li
                key={course.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                whileHover={{ y: -3 }}
                className={`rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)] transition-colors ${
                  softLocked ? "border-border opacity-75" : "border-indigo-100"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl surface-tint text-sm font-bold text-indigo-700">
                      {i + 1}
                    </span>
                    <div>
                      <h2 className="font-display text-lg font-bold text-indigo-900">{course.title}</h2>
                      <p className="mt-1 max-w-xl text-sm text-muted-foreground">{course.description}</p>
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <PlayCircle className="size-3.5" /> {course.lesson_count} lessons
                        {course.language_name ? ` · ${course.language_name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {pct === 100 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="size-3.5" /> Complete
                      </span>
                    ) : (
                      isAuthenticated && (
                        <span className="text-xs font-semibold text-indigo-700">{pct}%</span>
                      )
                    )}
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Link
                        to="/learn/$courseId"
                        params={{ courseId: course.id }}
                        className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700"
                      >
                        {pct > 0 ? "Continue" : "Start course"}
                      </Link>
                    </motion.div>
                  </div>
                </div>

                {softLocked && (
                  <p className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <Lock className="size-3.5" /> Suggested: finish “{prev?.title}” first — you can still start
                    this course now.
                  </p>
                )}
              </motion.li>
            );
          })}
        </ol>
      </main>
    </div>
  );
}
