import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  GripVertical,
  Plus,
  Save,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteCourse,
  deleteLesson,
  deleteResource,
  deleteSection,
  getBuilderCourse,
  getCourseImpact,
  listBuilderCourses,
  reorderItems,
  saveCourse,
  saveCoursePrerequisites,
  saveLesson,
  saveResource,
  saveSection,
  type BuilderLesson,
  type BuilderSection,
} from "@/lib/course-builder.functions";

const RESOURCE_TYPES = ["pdf", "slides", "link", "code"] as const;

export function CourseBuilderPanel() {
  const queryClient = useQueryClient();
  const fetchCourses = useServerFn(listBuilderCourses);
  const fetchCourse = useServerFn(getBuilderCourse);
  const persistCourse = useServerFn(saveCourse);
  const persistPrereqs = useServerFn(saveCoursePrerequisites);
  const persistSection = useServerFn(saveSection);
  const persistLesson = useServerFn(saveLesson);
  const persistResource = useServerFn(saveResource);
  const removeSection = useServerFn(deleteSection);
  const removeLesson = useServerFn(deleteLesson);
  const removeResource = useServerFn(deleteResource);
  const persistOrder = useServerFn(reorderItems);
  const removeCourse = useServerFn(deleteCourse);
  const fetchImpact = useServerFn(getCourseImpact);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [meta, setMeta] = useState({ title: "", description: "", language_id: "" });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    language_id: "",
    thumbnail_url: "",
  });
  // Portals need a real document, so only render them post-mount (client-side).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: catalog, error } = useQuery({
    queryKey: ["builder-courses"],
    queryFn: () => fetchCourses(),
    retry: false,
  });

  const { data: impact } = useQuery({
    queryKey: ["builder-course-impact"],
    queryFn: () => fetchImpact(),
    retry: false,
  });

  const { data: course } = useQuery({
    queryKey: ["builder-course", selectedId],
    queryFn: () => fetchCourse({ data: { courseId: selectedId! } }),
    enabled: Boolean(selectedId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["builder-course", selectedId] });
    queryClient.invalidateQueries({ queryKey: ["builder-courses"] });
    queryClient.invalidateQueries({ queryKey: ["builder-course-impact"] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["course", selectedId] });
  };

  const run = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Course builder is available to managers and admins only.
      </p>
    );
  }

  const sections: BuilderSection[] = course?.sections ?? [];

  async function reorderSections(next: BuilderSection[]) {
    queryClient.setQueryData(["builder-course", selectedId], (old: typeof course) =>
      old ? { ...old, sections: next } : old,
    );
    await persistOrder({ data: { kind: "section", ids: next.map((s) => s.id) } });
    invalidate();
  }

  async function reorderLessons(sectionId: string, next: BuilderLesson[]) {
    queryClient.setQueryData(["builder-course", selectedId], (old: typeof course) =>
      old
        ? {
            ...old,
            sections: old.sections.map((s) => (s.id === sectionId ? { ...s, lessons: next } : s)),
          }
        : old,
    );
    await persistOrder({ data: { kind: "lesson", ids: next.map((l) => l.id) } });
    invalidate();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl surface-tint text-indigo-700">
          <Wrench className="size-4" />
        </span>
        <h2 className="text-lg">Course builder</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Create courses, drag to reorder sections and lessons, and attach downloadable resources.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={selectedId ?? ""}
          onChange={(e) => {
            const id = e.target.value || null;
            setSelectedId(id);
            const found = catalog?.courses.find((c) => c.id === id);
            setMeta({
              title: found?.title ?? "",
              description: "",
              language_id: found?.language_id ?? "",
            });
          }}
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a course…</option>
          {(catalog?.courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            setCreateForm({ title: "", description: "", language_id: "", thumbnail_url: "" });
            setShowCreateForm(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700"
        >
          <Plus className="size-4" /> New course
        </motion.button>
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {showCreateForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 grid place-items-center bg-indigo-950/40 p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-lg rounded-2xl border border-border bg-card p-6"
                >
                  <h3 className="font-display text-lg font-semibold text-indigo-900">New course</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Set the basics now — sections, lessons and prerequisites are added afterward.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-indigo-900 sm:col-span-2">
                      Title
                      <input
                        autoFocus
                        value={createForm.title}
                        onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. Modern JavaScript"
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="text-xs font-semibold text-indigo-900 sm:col-span-2">
                      Description
                      <textarea
                        value={createForm.description}
                        onChange={(e) =>
                          setCreateForm((f) => ({ ...f, description: e.target.value }))
                        }
                        rows={3}
                        placeholder="What will students learn?"
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="text-xs font-semibold text-indigo-900">
                      Language
                      <select
                        value={createForm.language_id}
                        onChange={(e) =>
                          setCreateForm((f) => ({ ...f, language_id: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                      >
                        <option value="">General</option>
                        {(catalog?.languages ?? []).map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-indigo-900">
                      Thumbnail URL
                      <input
                        value={createForm.thumbnail_url}
                        onChange={(e) =>
                          setCreateForm((f) => ({ ...f, thumbnail_url: e.target.value }))
                        }
                        placeholder="https://…"
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="rounded-xl border border-border px-3 py-2 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        const title = createForm.title.trim();
                        if (!title) {
                          toast.error("Title is required");
                          return;
                        }
                        run.mutate(async () => {
                          const created = await persistCourse({
                            data: {
                              title,
                              description: createForm.description.trim() || null,
                              language_id: createForm.language_id || null,
                              thumbnail_url: createForm.thumbnail_url.trim() || null,
                            },
                          });
                          setSelectedId(created.id);
                          setMeta({
                            title,
                            description: createForm.description.trim(),
                            language_id: createForm.language_id,
                          });
                          setShowCreateForm(false);
                          toast.success("Course created");
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700"
                    >
                      <Plus className="size-4" /> Create course
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-indigo-50/60 text-xs uppercase tracking-wide text-indigo-700">
            <tr>
              <th className="px-4 py-2">Course</th>
              <th className="px-4 py-2">Lessons</th>
              <th className="px-4 py-2">Learners</th>
              <th className="px-4 py-2">Completion</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(catalog?.courses ?? []).map((c) => {
              const s = impact?.stats.find((x) => x.course_id === c.id);
              return (
                <tr key={c.id} className="border-t border-border/70 hover:bg-accent/50">
                  <td className="px-4 py-2 font-medium text-indigo-900">{c.title}</td>
                  <td className="px-4 py-2 text-muted-foreground">{s?.lessons ?? 0}</td>
                  <td className="px-4 py-2 text-muted-foreground">{s?.learners ?? 0}</td>
                  <td className="px-4 py-2 text-muted-foreground">{s?.completion_rate ?? 0}%</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedId(c.id);
                          setMeta({
                            title: c.title,
                            description: "",
                            language_id: c.language_id ?? "",
                          });
                        }}
                        className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: c.id, title: c.title })}
                        className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(catalog?.courses ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No courses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {deleteTarget && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 grid place-items-center bg-indigo-950/40 p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-md rounded-2xl border border-border bg-card p-6"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 text-amber-500" />
                    <div>
                      <h3 className="font-display text-lg font-semibold text-indigo-900">
                        Delete “{deleteTarget.title}”?
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        This permanently removes the course along with{" "}
                        {impact?.stats.find((s) => s.course_id === deleteTarget.id)?.lessons ?? 0}{" "}
                        lesson(s), all of its sections, quizzes, lesson resources and discussions,
                        plus the saved progress of{" "}
                        {impact?.stats.find((s) => s.course_id === deleteTarget.id)?.learners ?? 0}{" "}
                        enrolled learner(s) and any certificates issued for it. This cannot be
                        undone.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="rounded-xl border border-border px-3 py-2 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const id = deleteTarget.id;
                        setDeleteTarget(null);
                        run.mutate(async () => {
                          await removeCourse({ data: { courseId: id } });
                          if (selectedId === id) setSelectedId(null);
                          toast.success("Course deleted");
                        });
                      }}
                      className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Delete course
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {course && (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-indigo-900">
                Title
                <input
                  defaultValue={course.title}
                  onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="text-xs font-semibold text-indigo-900">
                Language
                <select
                  defaultValue={course.language_id ?? ""}
                  onChange={(e) => setMeta((m) => ({ ...m, language_id: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                >
                  <option value="">General</option>
                  {(catalog?.languages ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-indigo-900 sm:col-span-2">
                Description
                <textarea
                  defaultValue={course.description ?? ""}
                  rows={2}
                  onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                />
              </label>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() =>
                run.mutate(async () => {
                  await persistCourse({
                    data: {
                      id: course.id,
                      title: meta.title || course.title,
                      description: meta.description || course.description,
                      language_id: meta.language_id || course.language_id,
                    },
                  });
                  toast.success("Course saved");
                })
              }
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700"
            >
              <Save className="size-4" /> Save details
            </motion.button>

            <div className="mt-4 border-t border-border pt-4">
              <span className="text-xs font-semibold text-indigo-900">
                Prerequisites — students must finish these courses first
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(catalog?.courses ?? [])
                  .filter((c) => c.id !== course.id)
                  .map((c) => {
                    const on = course.prerequisiteIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          const next = on
                            ? course.prerequisiteIds.filter((id) => id !== c.id)
                            : [...course.prerequisiteIds, c.id];
                          queryClient.setQueryData(
                            ["builder-course", selectedId],
                            (old: typeof course) => (old ? { ...old, prerequisiteIds: next } : old),
                          );
                          run.mutate(async () => {
                            await persistPrereqs({
                              data: { courseId: course.id, prerequisiteIds: next },
                            });
                          });
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          on
                            ? "bg-primary text-primary-foreground"
                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        }`}
                      >
                        {c.title}
                      </button>
                    );
                  })}
                {(catalog?.courses ?? []).length <= 1 && (
                  <p className="text-xs text-muted-foreground">No other courses to require yet.</p>
                )}
              </div>
            </div>
          </div>

          <Reorder.Group
            axis="y"
            values={sections}
            onReorder={reorderSections}
            className="space-y-3"
          >
            {sections.map((section) => (
              <Reorder.Item
                key={section.id}
                value={section}
                className="rounded-2xl border border-indigo-100 bg-card p-4 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="size-4 cursor-grab text-indigo-300" />
                  <input
                    defaultValue={section.title}
                    onBlur={(e) =>
                      e.target.value !== section.title &&
                      run.mutate(async () => {
                        await persistSection({
                          data: { id: section.id, courseId: course.id, title: e.target.value },
                        });
                      })
                    }
                    className="flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-indigo-900 hover:border-input focus:border-input"
                  />
                  <button
                    onClick={() =>
                      window.confirm("Delete this section and its lessons?") &&
                      run.mutate(async () => {
                        await removeSection({ data: { sectionId: section.id } });
                        toast.success("Section deleted");
                      })
                    }
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete section"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <Reorder.Group
                  axis="y"
                  values={section.lessons}
                  onReorder={(next) => reorderLessons(section.id, next)}
                  className="mt-3 space-y-2 pl-6"
                >
                  {section.lessons.map((lesson) => (
                    <Reorder.Item
                      key={lesson.id}
                      value={lesson}
                      className="rounded-xl bg-muted/50 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="size-3.5 cursor-grab text-indigo-300" />
                        <button
                          onClick={() =>
                            setOpenLessonId(openLessonId === lesson.id ? null : lesson.id)
                          }
                          className="flex flex-1 items-center justify-between gap-2 text-left text-sm text-indigo-900"
                        >
                          <span>{lesson.title}</span>
                          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {lesson.duration_minutes} min · {lesson.resources.length} files
                            <ChevronDown
                              className={`size-3.5 transition-transform ${openLessonId === lesson.id ? "rotate-180" : ""}`}
                            />
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            window.confirm("Delete this lesson?") &&
                            run.mutate(async () => {
                              await removeLesson({ data: { lessonId: lesson.id } });
                              toast.success("Lesson deleted");
                            })
                          }
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete lesson"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      <AnimatePresence initial={false}>
                        {openLessonId === lesson.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <LessonField
                                label="Title"
                                defaultValue={lesson.title}
                                onCommit={(v) =>
                                  run.mutate(async () => {
                                    await persistLesson({
                                      data: { ...lessonPayload(lesson, section.id), title: v },
                                    });
                                  })
                                }
                              />
                              <LessonField
                                label="YouTube video ID"
                                defaultValue={lesson.youtube_video_id ?? ""}
                                onCommit={(v) =>
                                  run.mutate(async () => {
                                    await persistLesson({
                                      data: {
                                        ...lessonPayload(lesson, section.id),
                                        youtube_video_id: v,
                                      },
                                    });
                                  })
                                }
                              />
                              <LessonField
                                label="Duration (min)"
                                defaultValue={String(lesson.duration_minutes)}
                                onCommit={(v) =>
                                  run.mutate(async () => {
                                    await persistLesson({
                                      data: {
                                        ...lessonPayload(lesson, section.id),
                                        duration_minutes: Number(v) || 0,
                                      },
                                    });
                                  })
                                }
                              />
                              <LessonField
                                label="Practice topic"
                                defaultValue={lesson.practice_topic ?? ""}
                                onCommit={(v) =>
                                  run.mutate(async () => {
                                    await persistLesson({
                                      data: {
                                        ...lessonPayload(lesson, section.id),
                                        practice_topic: v,
                                        has_practice: Boolean(v),
                                      },
                                    });
                                  })
                                }
                              />
                              <LessonField
                                label="Drip: unlock N days after enrollment"
                                defaultValue={
                                  lesson.drip_after_days != null
                                    ? String(lesson.drip_after_days)
                                    : ""
                                }
                                onCommit={(v) =>
                                  run.mutate(async () => {
                                    await persistLesson({
                                      data: {
                                        ...lessonPayload(lesson, section.id),
                                        drip_after_days: v === "" ? null : Number(v),
                                      },
                                    });
                                  })
                                }
                              />
                              <LessonField
                                label="Drip: unlock on exact date (overrides above)"
                                type="datetime-local"
                                defaultValue={
                                  lesson.release_at
                                    ? new Date(lesson.release_at).toISOString().slice(0, 16)
                                    : ""
                                }
                                onCommit={(v) =>
                                  run.mutate(async () => {
                                    await persistLesson({
                                      data: {
                                        ...lessonPayload(lesson, section.id),
                                        release_at: v || null,
                                      },
                                    });
                                  })
                                }
                              />
                            </div>

                            <div className="mt-3 rounded-xl border border-border p-3">
                              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
                                <FileText className="size-3.5" /> Resources
                              </p>
                              <ul className="mt-2 space-y-1.5">
                                {lesson.resources.map((r) => (
                                  <li
                                    key={r.id}
                                    className="flex items-center justify-between gap-2 text-xs"
                                  >
                                    <span className="truncate">
                                      <span className="rounded surface-tint px-1.5 py-0.5 font-semibold uppercase text-indigo-700">
                                        {r.type}
                                      </span>{" "}
                                      {r.title}
                                    </span>
                                    <button
                                      onClick={() =>
                                        run.mutate(async () => {
                                          await removeResource({ data: { resourceId: r.id } });
                                        })
                                      }
                                      className="rounded p-1 text-muted-foreground hover:text-red-600"
                                      aria-label="Delete resource"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                              <ResourceForm
                                onAdd={(values) =>
                                  run.mutate(async () => {
                                    await persistResource({
                                      data: {
                                        lessonId: lesson.id,
                                        order_index: lesson.resources.length,
                                        ...values,
                                      },
                                    });
                                    toast.success("Resource added");
                                  })
                                }
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>

                <button
                  onClick={() => {
                    const title = window.prompt("New lesson title");
                    if (!title) return;
                    run.mutate(async () => {
                      await persistLesson({
                        data: {
                          sectionId: section.id,
                          title,
                          duration_minutes: 10,
                          order_index: section.lessons.length,
                        },
                      });
                      toast.success("Lesson added");
                    });
                  }}
                  className="mt-3 ml-6 inline-flex items-center gap-1.5 rounded-xl surface-tint px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  <Plus className="size-3.5" /> Add lesson
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          <button
            onClick={() => {
              const title = window.prompt("New section title");
              if (!title) return;
              run.mutate(async () => {
                await persistSection({
                  data: { courseId: course.id, title, order_index: sections.length },
                });
                toast.success("Section added");
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700"
          >
            <Plus className="size-4" /> Add section
          </button>
        </div>
      )}
    </div>
  );
}

function lessonPayload(lesson: BuilderLesson, sectionId: string) {
  return {
    id: lesson.id,
    sectionId,
    title: lesson.title,
    youtube_video_id: lesson.youtube_video_id,
    has_practice: lesson.has_practice,
    practice_topic: lesson.practice_topic,
    duration_minutes: lesson.duration_minutes,
    drip_after_days: lesson.drip_after_days,
    release_at: lesson.release_at,
  };
}

function LessonField({
  label,
  defaultValue,
  onCommit,
  type = "text",
}: {
  label: string;
  defaultValue: string;
  onCommit: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-[11px] font-semibold text-indigo-900">
      {label}
      <input
        type={type}
        defaultValue={defaultValue}
        onBlur={(e) => e.target.value !== defaultValue && onCommit(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-normal"
      />
    </label>
  );
}

function ResourceForm({
  onAdd,
}: {
  onAdd: (values: { title: string; file_url: string; type: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<string>("pdf");

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Resource title"
        className="min-w-32 flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        className="min-w-40 flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
      >
        {RESOURCE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (!title.trim() || !url.trim()) {
            toast.error("Title and URL are required");
            return;
          }
          onAdd({ title: title.trim(), file_url: url.trim(), type });
          setTitle("");
          setUrl("");
        }}
        className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-indigo-700"
      >
        Add
      </button>
    </div>
  );
}
