import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Clock, Dumbbell, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LessonQuiz } from "@/components/learn/LessonQuiz";
import { getCourse, getMyLessonProgress, setLessonComplete } from "@/lib/learn.functions";
import { getLessonQuiz, getMyQuizAttempts } from "@/lib/lms.functions";
import { useAuth } from "@/hooks/useAuth";

const courseQuery = (courseId: string) =>
  queryOptions({
    queryKey: ["course", courseId],
    queryFn: () => getCourse({ data: { courseId } }),
  });

export const Route = createFileRoute("/learn/$courseId")({
  loader: async ({ context, params }) => {
    const course = await context.queryClient.ensureQueryData(courseQuery(params.courseId));
    if (!course) throw notFound();
    return { title: course.title, description: course.description };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Course unavailable — Space" }, { name: "robots", content: "noindex" }],
      };
    }
    const description = loaderData.description ?? "A structured video course on Space.";
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
      Could not load this course. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Course not found.
    </div>
  ),
  component: CourseDetailPage,
});

function CourseDetailPage() {
  const { courseId } = Route.useParams();
  const { data: course } = useSuspenseQuery(courseQuery(courseId));
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const fetchProgress = useServerFn(getMyLessonProgress);
  const markLesson = useServerFn(setLessonComplete);

  const { data: progress } = useQuery({
    queryKey: ["lesson-progress"],
    queryFn: () => fetchProgress(),
    enabled: isAuthenticated,
  });
  const completed = useMemo(() => new Set(progress?.completed ?? []), [progress]);

  const mutation = useMutation({
    mutationFn: (vars: { lessonId: string; completed: boolean }) => markLesson({ data: vars }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["lesson-progress"] });
      queryClient.invalidateQueries({ queryKey: ["course-progress"] });
      if (result?.certificateCode) {
        queryClient.invalidateQueries({ queryKey: ["my-certificates"] });
        toast.success("Course complete — your certificate is ready!");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allLessons = useMemo(
    () => (course?.sections ?? []).flatMap((s) => s.lessons),
    [course],
  );
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(course?.sections.slice(0, 1).map((s) => s.id) ?? []),
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(allLessons[0]?.id ?? null);

  const activeLesson = allLessons.find((l) => l.id === activeLessonId) ?? allLessons[0] ?? null;

  const fetchQuiz = useServerFn(getLessonQuiz);
  const fetchAttempts = useServerFn(getMyQuizAttempts);
  const { data: activeQuiz } = useQuery({
    queryKey: ["lesson-quiz", activeLesson?.id ?? "none"],
    queryFn: () => fetchQuiz({ data: { lessonId: activeLesson!.id } }),
    enabled: Boolean(activeLesson),
  });
  const { data: attempts } = useQuery({
    queryKey: ["quiz-attempts"],
    queryFn: () => fetchAttempts(),
    enabled: isAuthenticated,
  });
  const passedQuizIds = attempts?.passedQuizIds ?? [];
  const quizLocked = Boolean(activeQuiz && !passedQuizIds.includes(activeQuiz.id));

  if (!course) return null;

  const doneCount = allLessons.filter((l) => completed.has(l.id)).length;
  const pct = allLessons.length ? Math.round((doneCount / allLessons.length) * 100) : 0;

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to="/learn" className="text-xs font-semibold text-indigo-700 hover:underline">
            ← All courses
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo-900">{course.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{course.description}</p>
          {isAuthenticated && (
            <div className="mt-4 max-w-sm">
              <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-50">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6 }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
              <p className="mt-1.5 text-xs font-semibold text-indigo-700">
                {doneCount} of {allLessons.length} lessons · {pct}% complete
              </p>
            </div>
          )}
        </motion.div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-soft)]">
            {course.sections.map((section, si) => {
              const open = openSections.has(section.id);
              const secDone = section.lessons.filter((l) => completed.has(l.id)).length;
              return (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: si * 0.05 }}
                  className="border-b border-border/70 last:border-0"
                >
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-indigo-900">{section.title}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {secDone}/{section.lessons.length} lessons
                      </span>
                    </span>
                    <motion.span animate={{ rotate: open ? 180 : 0 }}>
                      <ChevronDown className="size-4 text-muted-foreground" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pb-2"
                      >
                        {section.lessons.map((lesson) => {
                          const isDone = completed.has(lesson.id);
                          const isActive = activeLesson?.id === lesson.id;
                          return (
                            <li key={lesson.id}>
                              <button
                                onClick={() => setActiveLessonId(lesson.id)}
                                className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                                  isActive ? "bg-indigo-50 text-indigo-900" : "hover:bg-accent text-muted-foreground"
                                }`}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                                ) : (
                                  <Circle className="mt-0.5 size-4 shrink-0 text-indigo-300" />
                                )}
                                <span className="flex-1">
                                  {lesson.title}
                                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                    {lesson.duration_minutes} min
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </aside>

          <section>
            <AnimatePresence mode="wait">
              {activeLesson && (
                <motion.div
                  key={activeLesson.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                  className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
                >
                  <div className="aspect-video w-full overflow-hidden rounded-xl bg-indigo-900">
                    {activeLesson.youtube_video_id &&
                    !activeLesson.youtube_video_id.startsWith("PLACEHOLDER") ? (
                      <iframe
                        key={activeLesson.id}
                        src={`https://www.youtube.com/embed/${activeLesson.youtube_video_id}`}
                        title={activeLesson.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full"
                      />
                    ) : (
                      <div className="grid h-full place-items-center px-6 text-center text-sm text-indigo-100">
                        <div>
                          <PlayCircle className="mx-auto size-10 opacity-70" />
                          <p className="mt-3 font-semibold">Video not linked yet</p>
                          <p className="mt-1 text-xs opacity-80">
                            Placeholder ID{" "}
                            <code className="rounded bg-white/10 px-1">{activeLesson.youtube_video_id}</code> — swap it
                            for a real YouTube ID in the courses data.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl font-bold text-indigo-900">{activeLesson.title}</h2>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" /> {activeLesson.duration_minutes} min
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {activeLesson.has_practice && (
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          <Link
                            to="/practice"
                            search={{
                              lang: course.language_slug ?? "all",
                              q: activeLesson.practice_topic ?? "",
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl surface-tint px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                          >
                            <Dumbbell className="size-4" /> Practice this topic
                          </Link>
                        </motion.div>
                      )}
                      {isAuthenticated ? (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({
                              lessonId: activeLesson.id,
                              completed: !completed.has(activeLesson.id),
                            })
                          }
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                            completed.has(activeLesson.id)
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "bg-primary text-primary-foreground hover:bg-indigo-700"
                          }`}
                        >
                          <CheckCircle2 className="size-4" />
                          {completed.has(activeLesson.id) ? "Completed" : "Mark complete"}
                        </motion.button>
                      ) : (
                        <Link
                          to="/auth"
                          className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700"
                        >
                          Sign in to track progress
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>
    </div>
  );
}
