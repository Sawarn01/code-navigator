import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Archive, Check, Loader2, Play, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { CodeEditor } from "@/components/CodeEditor";
import {
  deleteQuestion,
  getAdminQuestion,
  listAdminQuestions,
  previewRunQuestion,
  saveQuestion,
  setQuestionArchived,
  type AdminTestCase,
} from "@/lib/question-admin.functions";

type Draft = {
  id: string | null;
  title: string;
  slug: string;
  category: "practice" | "cp";
  difficulty: "easy" | "medium" | "hard";
  description: string;
  constraints: string;
  starter_code: string;
  points: number;
  language_id: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  sql_setup: string;
  is_archived: boolean;
  testCases: AdminTestCase[];
  topicIds: string[];
  submissions: number;
};

const EMPTY: Draft = {
  id: null,
  title: "",
  slug: "",
  category: "practice",
  difficulty: "easy",
  description: "",
  constraints: "",
  starter_code: "",
  points: 50,
  language_id: "",
  time_limit_ms: 2000,
  memory_limit_mb: 256,
  sql_setup: "",
  is_archived: false,
  testCases: [{ input: "", expected_output: "", is_sample: true }],
  topicIds: [],
  submissions: 0,
};

const input =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400";
const label = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export function QuestionBuilderPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdminQuestions);
  const loadFn = useServerFn(getAdminQuestion);
  const saveFn = useServerFn(saveQuestion);
  const archiveFn = useServerFn(setQuestionArchived);
  const deleteFn = useServerFn(deleteQuestion);
  const previewFn = useServerFn(previewRunQuestion);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-questions"],
    queryFn: () => listFn(),
  });

  const [category, setCategory] = useState<"all" | "practice" | "cp">("all");
  const [language, setLanguage] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [preview, setPreview] = useState<
    { index: number; passed: boolean; actual: string; expected: string; stderr: string }[] | null
  >(null);

  const rows = useMemo(() => {
    const list = data?.questions ?? [];
    return list.filter((q) => {
      if (category !== "all" && q.category !== category) return false;
      if (language !== "all" && q.language_id !== language) return false;
      if (difficulty !== "all" && q.difficulty !== difficulty) return false;
      if (search && !q.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, category, language, difficulty, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    qc.invalidateQueries({ queryKey: ["practice-catalog"] });
  };

  const openNew = () =>
    setDraft({ ...EMPTY, language_id: data?.languages[0]?.id ?? "", testCases: [{ ...EMPTY.testCases[0]! }] });

  const openEdit = async (id: string) => {
    const q = await loadFn({ data: { questionId: id } });
    if (!q) {
      toast.error("Question not found");
      return;
    }
    setPreview(null);
    setDraft({
      id: q.id,
      title: q.title,
      slug: q.slug,
      category: q.category === "cp" ? "cp" : "practice",
      difficulty: q.difficulty as Draft["difficulty"],
      description: q.description,
      constraints: q.constraints ?? "",
      starter_code: q.starter_code ?? "",
      points: q.points,
      language_id: q.language_id ?? "",
      time_limit_ms: q.time_limit_ms,
      memory_limit_mb: q.memory_limit_mb,
      sql_setup: q.sql_setup ?? "",
      is_archived: q.is_archived,
      testCases: q.testCases.length ? q.testCases : [{ input: "", expected_output: "", is_sample: true }],
      topicIds: q.topicIds,
      submissions: q.submissions,
    });
  };

  const save = useMutation({
    mutationFn: async (d: Draft) =>
      saveFn({
        data: {
          id: d.id,
          title: d.title,
          slug: d.slug || d.title,
          category: d.category,
          difficulty: d.difficulty,
          description: d.description,
          constraints: d.constraints || null,
          starter_code: d.starter_code || null,
          points: d.points,
          language_id: d.language_id || null,
          time_limit_ms: d.time_limit_ms,
          memory_limit_mb: d.memory_limit_mb,
          sql_setup: d.sql_setup || null,
          is_archived: d.is_archived,
          testCases: d.testCases,
          topicIds: d.topicIds,
        },
      }),
    onSuccess: () => {
      toast.success("Question saved");
      setDraft(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: (v: { questionId: string; archived: boolean }) => archiveFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.archived ? "Question archived" : "Question restored");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (questionId: string) => deleteFn({ data: { questionId } }),
    onSuccess: () => {
      toast.success("Question deleted");
      setConfirmDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runPreview = useMutation({
    mutationFn: async (d: Draft) => {
      const slug = data?.languages.find((l) => l.id === d.language_id)?.slug;
      if (!slug) throw new Error("Pick a language first");
      const samples = d.testCases.filter((t) => t.is_sample);
      if (!samples.length) throw new Error("Mark at least one test case as a sample");
      return previewFn({
        data: {
          languageSlug: slug,
          code: d.starter_code,
          time_limit_ms: d.time_limit_ms,
          memory_limit_mb: d.memory_limit_mb,
          sql_setup: d.sql_setup || null,
          testCases: samples.map((t) => ({ input: t.input, expected_output: t.expected_output })),
        },
      });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message ?? "Execution service unavailable");
        return;
      }
      setPreview(
        res.results.map((r) => ({
          index: r.index,
          passed: r.passed,
          actual: r.actual,
          expected: r.expected,
          stderr: r.stderr,
        })),
      );
      toast[res.allPassed ? "success" : "warning"](
        res.allPassed ? "All sample cases pass" : "Some sample cases failed",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="grid h-40 place-items-center text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {(error as Error).message}
      </div>
    );
  }

  const deleteTarget = data?.questions.find((q) => q.id === confirmDelete);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions"
          className={`${input} max-w-xs`}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value as never)} className={`${input} w-auto`}>
          <option value="all">All categories</option>
          <option value="practice">Practice</option>
          <option value="cp">CP</option>
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`${input} w-auto`}>
          <option value="all">All languages</option>
          {data?.languages.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={`${input} w-auto`}>
          <option value="all">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={openNew}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" /> New question
        </motion.button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-indigo-50/60 text-xs uppercase tracking-wide text-indigo-700">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Difficulty</th>
              <th className="px-4 py-2">Tests</th>
              <th className="px-4 py-2">Subs</th>
              <th className="px-4 py-2">Topics</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id} className="border-t border-border/70 hover:bg-accent/50">
                <td className="px-4 py-2 font-medium text-indigo-900">
                  {q.title}
                  {q.is_archived && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                      archived
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 uppercase text-muted-foreground">{q.category}</td>
                <td className="px-4 py-2 capitalize text-muted-foreground">{q.difficulty}</td>
                <td className="px-4 py-2 text-muted-foreground">{q.test_cases}</td>
                <td className="px-4 py-2 text-muted-foreground">{q.submissions}</td>
                <td className="max-w-[220px] truncate px-4 py-2 text-xs text-muted-foreground">
                  {q.topics.join(", ") || "—"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => void openEdit(q.id)}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => archive.mutate({ questionId: q.id, archived: !q.is_archived })}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent"
                    >
                      <Archive className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(q.id)}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No questions match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
                    {deleteTarget.submissions > 0
                      ? `This question has ${deleteTarget.submissions} submission(s). Hard delete is blocked — archive it instead so student point history stays intact.`
                      : "This permanently removes the question, its test cases and topic tags. It has no submissions, so no student history is affected."}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                {deleteTarget.submissions > 0 ? (
                  <button
                    onClick={() => {
                      archive.mutate({ questionId: deleteTarget.id, archived: true });
                      setConfirmDelete(null);
                    }}
                    className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Archive instead
                  </button>
                ) : (
                  <button
                    onClick={() => remove.mutate(deleteTarget.id)}
                    className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Delete permanently
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {draft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 overflow-auto bg-indigo-950/40 p-4"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mx-auto w-full max-w-4xl rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-indigo-900">
                  {draft.id ? "Edit question" : "New question"}
                </h3>
                <button onClick={() => setDraft(null)} className="rounded-lg p-1.5 hover:bg-accent">
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className={label}>Title</span>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className={`${input} mt-1`}
                  />
                </div>
                <div>
                  <span className={label}>Slug</span>
                  <input
                    value={draft.slug}
                    onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                    placeholder="auto from title"
                    className={`${input} mt-1`}
                  />
                </div>
                <div>
                  <span className={label}>Language</span>
                  <select
                    value={draft.language_id}
                    onChange={(e) => setDraft({ ...draft, language_id: e.target.value })}
                    className={`${input} mt-1`}
                  >
                    <option value="">None</option>
                    {data?.languages.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={label}>Category</span>
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value as never })}
                    className={`${input} mt-1`}
                  >
                    <option value="practice">Practice</option>
                    <option value="cp">Competitive programming</option>
                  </select>
                </div>
                <div>
                  <span className={label}>Difficulty</span>
                  <select
                    value={draft.difficulty}
                    onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as never })}
                    className={`${input} mt-1`}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <span className={label}>Points</span>
                  <input
                    type="number"
                    value={draft.points}
                    onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })}
                    className={`${input} mt-1`}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="archived"
                    type="checkbox"
                    checked={draft.is_archived}
                    onChange={(e) => setDraft({ ...draft, is_archived: e.target.checked })}
                  />
                  <label htmlFor="archived" className="text-sm text-muted-foreground">
                    Hidden from students (archived)
                  </label>
                </div>

                {draft.category === "cp" && (
                  <>
                    <div>
                      <span className={label}>Time limit (ms)</span>
                      <input
                        type="number"
                        value={draft.time_limit_ms}
                        onChange={(e) => setDraft({ ...draft, time_limit_ms: Number(e.target.value) })}
                        className={`${input} mt-1`}
                      />
                    </div>
                    <div>
                      <span className={label}>Memory limit (MB)</span>
                      <input
                        type="number"
                        value={draft.memory_limit_mb}
                        onChange={(e) =>
                          setDraft({ ...draft, memory_limit_mb: Number(e.target.value) })
                        }
                        className={`${input} mt-1`}
                      />
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <span className={label}>Description (markdown)</span>
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    rows={6}
                    className={`${input} mt-1 font-mono text-xs`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <span className={label}>Constraints</span>
                  <textarea
                    value={draft.constraints}
                    onChange={(e) => setDraft({ ...draft, constraints: e.target.value })}
                    rows={3}
                    className={`${input} mt-1 font-mono text-xs`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <span className={label}>Starter code</span>
                  <div className="mt-1 overflow-hidden rounded-xl border border-border">
                    <CodeEditor
                      value={draft.starter_code}
                      onChange={(v) => setDraft({ ...draft, starter_code: v })}
                      language={data?.languages.find((l) => l.id === draft.language_id)?.slug ?? "javascript"}
                      height="220px"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <span className={label}>Topics</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {data?.topics.map((t) => {
                      const on = draft.topicIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              topicIds: on
                                ? draft.topicIds.filter((x) => x !== t.id)
                                : [...draft.topicIds, t.id],
                            })
                          }
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            on
                              ? "bg-primary text-primary-foreground"
                              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          }`}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className={label}>Test cases</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => runPreview.mutate(draft)}
                        disabled={runPreview.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                      >
                        {runPreview.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                        Run against sample cases
                      </button>
                      <button
                        onClick={() =>
                          setDraft({
                            ...draft,
                            testCases: [
                              ...draft.testCases,
                              { input: "", expected_output: "", is_sample: false },
                            ],
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <Plus className="size-3.5" /> Add case
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 space-y-2">
                    {draft.testCases.map((tc, i) => (
                      <div key={i} className="rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={tc.is_sample}
                              onChange={(e) => {
                                const next = [...draft.testCases];
                                next[i] = { ...tc, is_sample: e.target.checked };
                                setDraft({ ...draft, testCases: next });
                              }}
                            />
                            Sample (visible to students)
                          </label>
                          <button
                            onClick={() =>
                              setDraft({
                                ...draft,
                                testCases: draft.testCases.filter((_, x) => x !== i),
                              })
                            }
                            className="text-rose-600"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <textarea
                            value={tc.input}
                            onChange={(e) => {
                              const next = [...draft.testCases];
                              next[i] = { ...tc, input: e.target.value };
                              setDraft({ ...draft, testCases: next });
                            }}
                            rows={3}
                            placeholder="stdin"
                            className={`${input} font-mono text-xs`}
                          />
                          <textarea
                            value={tc.expected_output}
                            onChange={(e) => {
                              const next = [...draft.testCases];
                              next[i] = { ...tc, expected_output: e.target.value };
                              setDraft({ ...draft, testCases: next });
                            }}
                            rows={3}
                            placeholder="expected stdout"
                            className={`${input} font-mono text-xs`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {preview && (
                    <div className="mt-3 space-y-1.5">
                      {preview.map((r) => (
                        <div
                          key={r.index}
                          className={`rounded-xl border px-3 py-2 text-xs ${
                            r.passed
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-rose-200 bg-rose-50 text-rose-800"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            {r.passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                            Sample {r.index + 1}
                          </span>
                          {!r.passed && (
                            <pre className="mt-1 whitespace-pre-wrap font-mono">
                              expected: {r.expected}
                              {"\n"}got: {r.actual}
                              {r.stderr ? `\n${r.stderr}` : ""}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setDraft(null)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  disabled={save.isPending}
                  onClick={() => save.mutate(draft)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {save.isPending && <Loader2 className="size-4 animate-spin" />}
                  Save question
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
