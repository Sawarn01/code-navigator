import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Clock, Dumbbell, Lock, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LessonQuiz } from "@/components/learn/LessonQuiz";
import { LessonDiscussion } from "@/components/learn/LessonDiscussion";
import { CourseReviews } from "@/components/learn/CourseReviews";
import {
  getCourse,
  getMyLessonProgress,
  setLessonComplete,
  updateLessonProgress,
} from "@/lib/learn.functions";
import { getMyCourseAccess } from "@/lib/course-access.functions";
import { getLessonQuiz, getMyQuizAttempts } from "@/lib/lms.functions";
import { getLessonDropOff } from "@/lib/analytics.functions";
import { useAuth } from "@/hooks/useAuth";

/** Minimal surface of the YouTube IFrame Player API — no @types package is
 * installed, so this declares just what useYouTubeWatchTracker calls. */
type YTPlayerState = -1 | 0 | 1 | 2 | 3 | 5;
interface YTPlayerInstance {
  getCurrentTime: () => number;
  destroy: () => void;
}
interface YTNamespace {
  Player: new (
    elementId: string,
    options: { events?: { onStateChange?: (e: { data: YTPlayerState }) => void } },
  ) => YTPlayerInstance;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_PLAYING: YTPlayerState = 1;

let ytApiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error("YT namespace missing after API load"));
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => reject(new Error("Failed to load the YouTube IFrame API"));
    document.head.appendChild(script);
    setTimeout(() => reject(new Error("YouTube IFrame API load timed out")), 10000);
  });
  return ytApiPromise;
}

/**
 * Tracks real video playback position/watch-time via the YouTube IFrame
 * Player API (the embed carries enablejsapi=1 and a matching element id).
 * Watched seconds only accrue while the player reports PLAYING, so paused
 * or buffering time isn't counted. If the API fails to load (script
 * blocked, etc.) this degrades to a wall-clock "time on page" proxy rather
 * than silently tracking nothing.
 */
function useYouTubeWatchTracker(lessonId: string | null, videoId: string | null, enabled: boolean) {
  const track = useServerFn(updateLessonProgress);

  useEffect(() => {
    if (!lessonId || !videoId || !enabled) return;
    let cancelled = false;
    let player: YTPlayerInstance | null = null;
    let tickId: ReturnType<typeof setInterval> | null = null;
    let fallbackId: ReturnType<typeof setInterval> | null = null;
    let elapsed = 0;
    let unsaved = 0;
    let lastPosition = 0;

    const flush = (position: number) => {
      if (unsaved <= 0) return;
      const delta = unsaved;
      unsaved = 0;
      void track({
        data: { lessonId, positionSeconds: Math.round(position), watchedDeltaSeconds: delta },
      });
    };

    const startFallback = () => {
      fallbackId = setInterval(() => {
        elapsed += 1;
        unsaved += 1;
        if (unsaved >= 15) flush(elapsed);
      }, 1000);
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(`yt-player-${lessonId}`, {
          events: {
            onStateChange: (e) => {
              if (e.data === YT_PLAYING) {
                if (tickId) return;
                tickId = setInterval(() => {
                  lastPosition = player?.getCurrentTime() ?? lastPosition;
                  unsaved += 1;
                  if (unsaved >= 15) flush(lastPosition);
                }, 1000);
              } else if (tickId) {
                clearInterval(tickId);
                tickId = null;
                lastPosition = player?.getCurrentTime() ?? lastPosition;
                flush(lastPosition);
              }
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) startFallback();
      });

    return () => {
      cancelled = true;
      if (tickId) clearInterval(tickId);
      if (fallbackId) clearInterval(fallbackId);
      flush(fallbackId ? elapsed : lastPosition);
      try {
        player?.destroy();
      } catch {
        // Player may already be torn down by the API itself.
      }
    };
  }, [lessonId, videoId, enabled, track]);
}

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
  const { isAuthenticated, user, role } = useAuth();
  const isStaff = role === "admin" || role === "manager";
  const queryClient = useQueryClient();

  const fetchProgress = useServerFn(getMyLessonProgress);
  const markLesson = useServerFn(setLessonComplete);

  const { data: progress } = useQuery({
    queryKey: ["lesson-progress"],
    queryFn: () => fetchProgress(),
    enabled: isAuthenticated,
  });
  const completed = useMemo(() => new Set(progress?.completed ?? []), [progress]);

  const fetchAccess = useServerFn(getMyCourseAccess);
  const { data: access } = useQuery({
    queryKey: ["course-access", courseId],
    queryFn: () => fetchAccess({ data: { courseId } }),
    enabled: isAuthenticated,
  });
  const lessonAccessById = useMemo(
    () => new Map((access?.lessons ?? []).map((l) => [l.lessonId, l])),
    [access],
  );

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

  const allLessons = useMemo(() => (course?.sections ?? []).flatMap((s) => s.lessons), [course]);
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

  const courseLocked = access ? !access.unlocked : false;
  const activeLessonAccess = activeLesson ? lessonAccessById.get(activeLesson.id) : null;
  const activeLessonLocked = activeLessonAccess ? !activeLessonAccess.unlocked : false;

  const activeVideoId =
    activeLesson?.youtube_video_id && !activeLesson.youtube_video_id.startsWith("PLACEHOLDER")
      ? activeLesson.youtube_video_id
      : null;

  useYouTubeWatchTracker(
    activeLesson?.id ?? null,
    activeVideoId,
    isAuthenticated &&
      !courseLocked &&
      !activeLessonLocked &&
      !completed.has(activeLesson?.id ?? ""),
  );

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
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
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

        {courseLocked && access && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6"
          >
            <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-amber-900">
              <Lock className="size-5" /> Finish the prerequisites first
            </h2>
            <ul className="mt-4 space-y-2">
              {access.prerequisites.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/learn/$courseId"
                    params={{ courseId: p.id }}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:underline"
                  >
                    {p.completed ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <Circle className="size-4" />
                    )}
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        <div
          className={`mt-8 grid gap-6 lg:grid-cols-[340px_1fr] ${
            courseLocked ? "pointer-events-none opacity-40" : ""
          }`}
        >
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
                      <span className="block text-sm font-semibold text-indigo-900">
                        {section.title}
                      </span>
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
                          const lessonLocked = lessonAccessById.get(lesson.id)?.unlocked === false;
                          return (
                            <li key={lesson.id}>
                              <button
                                onClick={() => setActiveLessonId(lesson.id)}
                                className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                                  isActive
                                    ? "bg-indigo-50 text-indigo-900"
                                    : "hover:bg-accent text-muted-foreground"
                                }`}
                              >
                                {lessonLocked ? (
                                  <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                ) : isDone ? (
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
                    {activeLessonLocked ? (
                      <div className="grid h-full place-items-center px-6 text-center text-sm text-indigo-100">
                        <div>
                          <Lock className="mx-auto size-10 opacity-70" />
                          <p className="mt-3 font-semibold">This lesson is drip-locked</p>
                          <p className="mt-1 text-xs opacity-80">
                            {activeLessonAccess?.unlocksAt
                              ? `Unlocks ${new Date(activeLessonAccess.unlocksAt).toLocaleDateString()}`
                              : "Check back soon."}
                          </p>
                        </div>
                      </div>
                    ) : activeVideoId ? (
                      <iframe
                        key={activeLesson.id}
                        id={`yt-player-${activeLesson.id}`}
                        src={`https://www.youtube.com/embed/${activeVideoId}?enablejsapi=1`}
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
                            <code className="rounded bg-white/10 px-1">
                              {activeLesson.youtube_video_id}
                            </code>{" "}
                            — swap it for a real YouTube ID in the courses data.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl font-bold text-indigo-900">
                        {activeLesson.title}
                      </h2>
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
                          whileHover={{ scale: quizLocked || activeLessonLocked ? 1 : 1.03 }}
                          whileTap={{ scale: quizLocked || activeLessonLocked ? 1 : 0.97 }}
                          disabled={
                            mutation.isPending ||
                            activeLessonLocked ||
                            (quizLocked && !completed.has(activeLesson.id))
                          }
                          title={
                            activeLessonLocked
                              ? "This lesson is drip-locked"
                              : quizLocked && !completed.has(activeLesson.id)
                                ? "Pass the lesson quiz to unlock completion"
                                : undefined
                          }
                          onClick={() =>
                            mutation.mutate({
                              lessonId: activeLesson.id,
                              completed: !completed.has(activeLesson.id),
                            })
                          }
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                            completed.has(activeLesson.id)
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "bg-primary text-primary-foreground hover:bg-indigo-700"
                          }`}
                        >
                          {quizLocked && !completed.has(activeLesson.id) ? (
                            <Lock className="size-4" />
                          ) : (
                            <CheckCircle2 className="size-4" />
                          )}
                          {completed.has(activeLesson.id)
                            ? "Completed"
                            : quizLocked
                              ? "Pass quiz to complete"
                              : "Mark complete"}
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

                  {!activeLessonLocked && activeQuiz && (
                    <div className="mt-6 border-t border-border pt-6">
                      <LessonQuiz
                        lessonId={activeLesson.id}
                        passedQuizIds={passedQuizIds}
                        onPassed={() => {
                          queryClient.invalidateQueries({ queryKey: ["quiz-attempts"] });
                        }}
                      />
                    </div>
                  )}

                  {!activeLessonLocked && (
                    <div className="mt-6 border-t border-border pt-6">
                      <LessonDiscussion
                        lessonId={activeLesson.id}
                        currentUserId={user?.id ?? null}
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6">
              <CourseReviews courseId={courseId} currentUserId={user?.id ?? null} />
            </div>
          </section>
        </div>

        {isStaff && <LessonDropOffPanel courseId={courseId} />}
      </main>
    </div>
  );
}

function LessonDropOffPanel({ courseId }: { courseId: string }) {
  const fetchDropOff = useServerFn(getLessonDropOff);
  const { data: rows } = useQuery({
    queryKey: ["lesson-drop-off", courseId],
    queryFn: () => fetchDropOff({ data: { courseId } }),
  });

  if (!rows?.length) return null;
  const maxStarted = Math.max(1, ...rows.map((r) => r.started));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
    >
      <h2 className="font-display text-lg font-bold text-indigo-900">
        Lesson drop-off — staff only
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Students who reached vs. finished each lesson, and average time spent.
      </p>
      <div className="mt-4 space-y-3">
        {rows.map((r) => {
          const finishRate = r.started > 0 ? Math.round((r.completed / r.started) * 100) : 0;
          return (
            <div key={r.lessonId}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-900">
                  {r.sectionTitle} · {r.title}
                </span>
                <span className="text-muted-foreground">
                  {r.completed}/{r.started} finished ({finishRate}%) · avg{" "}
                  {Math.round(r.avgWatchSeconds / 60)}m watched
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-indigo-50">
                <div
                  className="h-full rounded-full bg-indigo-300"
                  style={{ width: `${(r.started / maxStarted) * 100}%` }}
                />
                <div
                  className="-mt-2 h-2 rounded-full bg-primary"
                  style={{ width: `${(r.completed / maxStarted) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
