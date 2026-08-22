import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import {
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
  deleteLesson,
  deleteResource,
  deleteSection,
  getBuilderCourse,
  listBuilderCourses,
  reorderItems,
  saveCourse,
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
  const persistSection = useServerFn(saveSection);
  const persistLesson = useServerFn(saveLesson);
  const persistResource = useServerFn(saveResource);
  const removeSection = useServerFn(deleteSection);
  const removeLesson = useServerFn(deleteLesson);
  const removeResource = useServerFn(deleteResource);
  const persistOrder = useServerFn(reorderItems);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [meta, setMeta] = useState({ title: "", description: "", language_id: "" });

  const { data: catalog, error } = useQuery({
    queryKey: ["builder-courses"],
    queryFn: () => fetchCourses(),
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
            setMeta({ title: found?.title ?? "", description: "", language_id: found?.language_id ?? "" });
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
          onClick={async () => {
            const title = window.prompt("New course title");
            if (!title) return;
            const created = await persistCourse({ data: { title } });
            setSelectedId(created.id);
            invalidate();
            toast.success("Course created");
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700"
        >
          <Plus className="size-4" /> New course
        </motion.button>
      </div>

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
          </div>

          <Reorder.Group axis="y" values={sections} onReorder={reorderSections} className="space-y-3">
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
                    <Reorder.Item key={lesson.id} value={lesson} className="rounded-xl bg-muted/50 p-2">
                      <div className="flex items-center gap-2">
                        <GripVertical className="size-3.5 cursor-grab text-indigo-300" />
                        <button
                          onClick={() => setOpenLessonId(openLessonId === lesson.id ? null : lesson.id)}
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
  };
}

function LessonField({
  label,
  defaultValue,
  onCommit,
}: {
  label: string;
  defaultValue: string;
  onCommit: (value: string) => void;
}) {
  return (
    <label className="text-[11px] font-semibold text-indigo-900">
      {label}
      <input
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
          if (!title.trim() || !url.trim()) return toast.error("Title and URL are required");
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
