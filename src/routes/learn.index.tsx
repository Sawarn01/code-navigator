import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { BookOpen, Clock, PlayCircle } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { getCourses, getMyLessonProgress } from "@/lib/learn.functions";
import { useAuth } from "@/hooks/useAuth";

const coursesQuery = queryOptions({
  queryKey: ["courses"],
  queryFn: () => getCourses(),
});

export const Route = createFileRoute("/learn/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(coursesQuery),
  head: () => ({
    meta: [
      { title: "Video Courses — Space" },
      {
        name: "description",
        content:
          "Structured video courses in JavaScript, Python, Java and C++ with practice problems attached to every lesson.",
      },
      { property: "og:title", content: "Video Courses — Space" },
      {
        property: "og:description",
        content: "Learn by watching, then solve practice problems tied to each topic.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Could not load courses. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Page not found.
    </div>
  ),
  component: LearnPage,
});

const TINTS = [
  "from-indigo-500 to-indigo-700",
  "from-indigo-400 to-indigo-600",
  "from-indigo-600 to-indigo-900",
  "from-indigo-500 to-violet-600",
];

function LearnPage() {
  const { data: courses } = useSuspenseQuery(coursesQuery);
  const { isAuthenticated } = useAuth();
  const fetchProgress = useServerFn(getMyLessonProgress);
  const { data: progress } = useQuery({
    queryKey: ["lesson-progress"],
    queryFn: () => fetchProgress(),
    enabled: isAuthenticated,
  });

  const [language, setLanguage] = useState("all");

  const languages = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of courses) if (c.language_slug) seen.set(c.language_slug, c.language_name ?? c.language_slug);
    return [...seen.entries()];
  }, [courses]);

  const filtered = courses.filter((c) => language === "all" || c.language_slug === language);
  const completedCount = progress?.completed.length ?? 0;
  const totalLessons = courses.reduce((sum, c) => sum + c.lesson_count, 0);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-display text-3xl font-bold text-indigo-900">Learn</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Structured video tracks with practice attached to every lesson. Watch a topic, then solve
            problems on it while it is still fresh.
          </p>
        </motion.div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setLanguage("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              language === "all" ? "bg-primary text-primary-foreground" : "surface-tint text-indigo-700 hover:bg-indigo-100"
            }`}
          >
            All tracks
          </button>
          {languages.map(([slug, name]) => (
            <motion.button
              key={slug}
              whileTap={{ scale: 0.95 }}
              onClick={() => setLanguage(slug)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                language === slug ? "bg-primary text-primary-foreground" : "surface-tint text-indigo-700 hover:bg-indigo-100"
              }`}
            >
              {name}
            </motion.button>
          ))}
          {isAuthenticated && totalLessons > 0 && (
            <span className="ml-auto text-xs font-semibold text-indigo-700">
              {completedCount} / {totalLessons} lessons complete
            </span>
          )}
        </div>

        <div className="bento-grid mt-8">
          {filtered.map((course, i) => (
            <BentoCard key={course.id} delay={i * 0.06} className={i % 3 === 0 ? "lg:col-span-4" : "lg:col-span-2"}>
              <Link to="/learn/$courseId" params={{ courseId: course.id }} className="block">
                <div
                  className={`grid h-28 place-items-center rounded-xl bg-gradient-to-br ${TINTS[i % TINTS.length]} text-3xl font-bold text-white`}
                >
                  {course.language_name ?? "CS"}
                </div>
                <h2 className="mt-4 font-display text-lg font-bold text-indigo-900">{course.title}</h2>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <PlayCircle className="size-3.5" /> {course.lesson_count} lessons
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" /> {Math.round(course.total_minutes / 60)}h
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="size-3.5" /> {course.language_name}
                  </span>
                </div>
                {isAuthenticated && <CourseProgressBar courseId={course.id} total={course.lesson_count} />}
              </Link>
            </BentoCard>
          ))}
          {filtered.length === 0 && (
            <p className="lg:col-span-6 py-16 text-center text-sm text-muted-foreground">
              No courses for this track yet.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function CourseProgressBar({ courseId, total }: { courseId: string; total: number }) {
  const { data } = useQuery<{ done: number }>({ queryKey: ["course-progress", courseId], enabled: false });
  const done = data?.done ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mt-4">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-50">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="h-full rounded-full bg-primary"
        />
      </div>
      <p className="mt-1.5 text-[11px] font-semibold text-indigo-700">{pct}% complete</p>
    </div>
  );
}
