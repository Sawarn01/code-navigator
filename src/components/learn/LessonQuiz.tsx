import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Award, CheckCircle2, HelpCircle, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { CodeEditor } from "@/components/CodeEditor";
import { getLessonQuiz, submitQuizAttempt, type QuizGrade } from "@/lib/lms.functions";

export function LessonQuiz({
  lessonId,
  passedQuizIds,
  onPassed,
}: {
  lessonId: string;
  passedQuizIds: string[];
  onPassed: () => void;
}) {
  const fetchQuiz = useServerFn(getLessonQuiz);
  const submit = useServerFn(submitQuizAttempt);
  const queryClient = useQueryClient();

  const { data: quiz } = useQuery({
    queryKey: ["lesson-quiz", lessonId],
    queryFn: () => fetchQuiz({ data: { lessonId } }),
  });

  const [choices, setChoices] = useState<Record<string, number>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [grade, setGrade] = useState<QuizGrade | null>(null);

  const alreadyPassed = useMemo(
    () => (quiz ? passedQuizIds.includes(quiz.id) : false),
    [quiz, passedQuizIds],
  );

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          quizId: quiz!.id,
          answers: (quiz?.questions ?? []).map((q) =>
            q.kind === "code"
              ? {
                  questionId: q.id,
                  code: codes[q.id] ?? q.starter_code ?? "",
                  language: q.language_slug ?? "python",
                }
              : { questionId: q.id, option: choices[q.id] ?? null },
          ),
        },
      }),
    onSuccess: (result) => {
      setGrade(result);
      queryClient.invalidateQueries({ queryKey: ["quiz-attempts"] });
      if (result.passed) {
        toast.success(`Passed with ${result.score}%`);
        onPassed();
      } else {
        toast.error(`Scored ${result.score}% — try again`);
      }
      if (result.certificateCode) {
        toast.success("Certificate issued for this course!");
        queryClient.invalidateQueries({ queryKey: ["my-certificates"] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!quiz) return null;

  const answeredAll = quiz.questions.every((q) =>
    q.kind === "code" ? (codes[q.id] ?? q.starter_code ?? "").trim().length > 0 : choices[q.id] !== undefined,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-6 rounded-2xl border border-indigo-100 bg-card p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-5 text-indigo-600" />
          <h3 className="font-display text-lg font-bold text-indigo-900">{quiz.title}</h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            alreadyPassed
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "surface-tint text-indigo-700"
          }`}
        >
          {alreadyPassed ? "Passed" : `Pass mark ${quiz.pass_threshold}%`}
        </span>
      </div>

      <div className="mt-5 space-y-5">
        {quiz.questions.map((q, i) => {
          const feedback = grade?.perQuestion.find((p) => p.id === q.id);
          return (
            <div key={q.id} className="rounded-xl border border-border p-4">
              <p className="text-sm font-semibold text-indigo-900">
                {i + 1}. {q.question_text}
              </p>

              {q.kind === "code" ? (
                <div className="mt-3">
                  <CodeEditor
                    value={codes[q.id] ?? q.starter_code ?? ""}
                    onChange={(v) => setCodes((prev) => ({ ...prev, [q.id]: v }))}
                    language={q.language_slug ?? "python"}
                    height="220px"
                  />
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {q.options.map((opt, oi) => {
                    const selected = choices[q.id] === oi;
                    const isAnswer = feedback?.correct_option === oi;
                    return (
                      <motion.button
                        key={oi}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setChoices((prev) => ({ ...prev, [q.id]: oi }))}
                        className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                          feedback && isAnswer
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : feedback && selected
                              ? "border-rose-300 bg-rose-50 text-rose-800"
                              : selected
                                ? "border-indigo-300 surface-tint text-indigo-900"
                                : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        <span className="grid size-5 shrink-0 place-items-center rounded-full border border-current text-[10px] font-bold">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        {opt}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              <AnimatePresence>
                {feedback && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mt-3 flex items-start gap-2 text-xs ${
                      feedback.correct ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {feedback.correct ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 size-3.5 shrink-0" />
                    )}
                    <span>{feedback.explanation ?? (feedback.correct ? "Correct." : "Not quite.")}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          disabled={!answeredAll || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {grade ? <RotateCcw className="size-4" /> : <CheckCircle2 className="size-4" />}
          {mutation.isPending ? "Grading…" : grade ? "Retake quiz" : "Submit answers"}
        </motion.button>
        {grade && (
          <span className="text-sm font-semibold text-indigo-700">
            Score {grade.score}% · {grade.passed ? "passed" : "not passed yet"}
          </span>
        )}
        {grade?.certificateCode && (
          <Link
            to="/certificate/$certificateCode"
            params={{ certificateCode: grade.certificateCode }}
            className="inline-flex items-center gap-1.5 rounded-xl surface-tint px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            <Award className="size-4" /> View certificate
          </Link>
        )}
      </div>
    </motion.div>
  );
}
