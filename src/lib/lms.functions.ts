import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverPublicClient } from "@/lib/supabase-server";

export type QuizQuestionPublic = {
  id: string;
  kind: "mcq" | "code";
  question_text: string;
  options: string[];
  order_index: number;
  practice_question_id: string | null;
  starter_code: string | null;
  language_slug: string | null;
};

export type LessonQuiz = {
  id: string;
  title: string;
  pass_threshold: number;
  questions: QuizQuestionPublic[];
};

export type QuizGrade = {
  score: number;
  passed: boolean;
  perQuestion: { id: string; correct: boolean; correct_option: number | null; explanation: string | null }[];
  certificateCode: string | null;
};

export type PathSummary = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  course_count: number;
  lesson_count: number;
  courses: { id: string; title: string }[];
};

export type PathCourse = {
  id: string;
  title: string;
  description: string | null;
  language_name: string | null;
  lesson_count: number;
  order_index: number;
};

export type PathDetail = {
  id: string;
  title: string;
  description: string | null;
  courses: PathCourse[];
};

export type CertificateView = {
  certificate_code: string;
  issued_at: string;
  course_title: string;
  course_description: string | null;
  full_name: string | null;
};

/** Public quiz payload — answer keys are stripped server-side. */
export const getLessonQuiz = createServerFn({ method: "POST" })
  .inputValidator((input: { lessonId: string }) => ({ lessonId: String(input.lessonId) }))
  .handler(async ({ data }): Promise<LessonQuiz | null> => {
    const supabase = serverPublicClient();
    const { data: quiz } = await supabase
      .from("course_quizzes")
      .select("id, title, pass_threshold")
      .eq("lesson_id", data.lessonId)
      .maybeSingle();
    if (!quiz) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("quiz_questions")
      .select("id, kind, question_text, options, order_index, practice_question_id")
      .eq("quiz_id", quiz.id)
      .order("order_index");

    const practiceIds = (rows ?? [])
      .map((r) => r.practice_question_id)
      .filter((v): v is string => Boolean(v));
    const { data: practice } = practiceIds.length
      ? await supabaseAdmin
          .from("questions")
          .select("id, starter_code, languages(slug)")
          .in("id", practiceIds)
      : { data: [] as { id: string; starter_code: string | null; languages: { slug: string } | null }[] };

    return {
      ...quiz,
      questions: (rows ?? []).map((r) => {
        const p = (practice ?? []).find((x) => x.id === r.practice_question_id);
        return {
          id: r.id,
          kind: (r.kind === "code" ? "code" : "mcq") as "mcq" | "code",
          question_text: r.question_text,
          options: Array.isArray(r.options) ? (r.options as string[]) : [],
          order_index: r.order_index,
          practice_question_id: r.practice_question_id,
          starter_code: p?.starter_code ?? null,
          language_slug: (p?.languages as { slug: string } | null)?.slug ?? null,
        };
      }),
    };
  });

export const getMyQuizAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ passedQuizIds: string[]; best: Record<string, number> }> => {
    const { data } = await context.supabase
      .from("quiz_attempts")
      .select("quiz_id, score, passed")
      .eq("user_id", context.userId)
      .limit(2000);
    const best: Record<string, number> = {};
    const passed = new Set<string>();
    for (const row of data ?? []) {
      best[row.quiz_id] = Math.max(best[row.quiz_id] ?? 0, row.score);
      if (row.passed) passed.add(row.quiz_id);
    }
    return { passedQuizIds: [...passed], best };
  });

export const submitQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      quizId: string;
      answers: { questionId: string; option?: number | null; code?: string | null; language?: string | null }[];
    }) => ({
      quizId: String(input.quizId),
      answers: (input.answers ?? []).slice(0, 20).map((a) => ({
        questionId: String(a.questionId),
        option: a.option === null || a.option === undefined ? null : Number(a.option),
        code: a.code ? String(a.code).slice(0, 60000) : null,
        language: a.language ? String(a.language) : null,
      })),
    }),
  )
  .handler(async ({ context, data }): Promise<QuizGrade> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quiz } = await supabaseAdmin
      .from("course_quizzes")
      .select("id, pass_threshold, lesson_id")
      .eq("id", data.quizId)
      .maybeSingle();
    if (!quiz) throw new Error("Quiz not found");

    const { data: questions } = await supabaseAdmin
      .from("quiz_questions")
      .select("id, kind, correct_option, explanation, practice_question_id")
      .eq("quiz_id", quiz.id)
      .order("order_index");

    const perQuestion: QuizGrade["perQuestion"] = [];
    for (const q of questions ?? []) {
      const answer = data.answers.find((a) => a.questionId === q.id);
      let correct = false;
      if (q.kind === "code" && q.practice_question_id && answer?.code && answer.language) {
        const { loadQuestion, runAgainstTests } = await import("@/lib/judge.server");
        const question = await loadQuestion(q.practice_question_id);
        const outcome = await runAgainstTests({
          question,
          languageSlug: answer.language,
          code: answer.code,
          samplesOnly: false,
        });
        correct = outcome.ok && outcome.allPassed;
      } else {
        correct = answer?.option !== null && answer?.option === q.correct_option;
      }
      perQuestion.push({
        id: q.id,
        correct,
        correct_option: q.kind === "code" ? null : q.correct_option,
        explanation: q.explanation,
      });
    }

    const total = perQuestion.length || 1;
    const score = Math.round((perQuestion.filter((p) => p.correct).length / total) * 100);
    const passed = score >= quiz.pass_threshold;

    await context.supabase
      .from("quiz_attempts")
      .insert({ user_id: context.userId, quiz_id: quiz.id, score, passed });

    let certificateCode: string | null = null;
    if (passed) {
      const { data: lesson } = await supabaseAdmin
        .from("course_lessons")
        .select("course_sections(course_id)")
        .eq("id", quiz.lesson_id)
        .maybeSingle();
      const courseId = (lesson?.course_sections as { course_id: string } | null)?.course_id;
      if (courseId) {
        const { data: code } = await supabaseAdmin.rpc("issue_certificate_if_complete", {
          _user_id: context.userId,
          _course_id: courseId,
        });
        certificateCode = (code as string | null) ?? null;
      }
    }

    return { score, passed, perQuestion, certificateCode };
  });

export const getPaths = createServerFn({ method: "GET" }).handler(async (): Promise<PathSummary[]> => {
  const supabase = serverPublicClient();
  const [{ data: paths }, { data: links }, { data: courses }, { data: sections }, { data: lessons }] =
    await Promise.all([
      supabase.from("learning_paths").select("id, title, description, thumbnail_url, order_index").order("order_index"),
      supabase.from("learning_path_courses").select("path_id, course_id, order_index").order("order_index"),
      supabase.from("courses").select("id, title"),
      supabase.from("course_sections").select("id, course_id"),
      supabase.from("course_lessons").select("id, section_id").limit(2000),
    ]);

  const lessonsPerCourse = new Map<string, number>();
  const sectionToCourse = new Map((sections ?? []).map((s) => [s.id, s.course_id]));
  for (const l of lessons ?? []) {
    const cid = sectionToCourse.get(l.section_id);
    if (cid) lessonsPerCourse.set(cid, (lessonsPerCourse.get(cid) ?? 0) + 1);
  }

  return (paths ?? []).map((p) => {
    const rows = (links ?? []).filter((l) => l.path_id === p.id);
    const pathCourses = rows
      .map((r) => (courses ?? []).find((c) => c.id === r.course_id))
      .filter((c): c is { id: string; title: string } => Boolean(c));
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      thumbnail_url: p.thumbnail_url,
      course_count: pathCourses.length,
      lesson_count: pathCourses.reduce((acc, c) => acc + (lessonsPerCourse.get(c.id) ?? 0), 0),
      courses: pathCourses,
    };
  });
});

export const getPath = createServerFn({ method: "POST" })
  .inputValidator((input: { pathId: string }) => ({ pathId: String(input.pathId) }))
  .handler(async ({ data }): Promise<PathDetail | null> => {
    const supabase = serverPublicClient();
    const { data: path } = await supabase
      .from("learning_paths")
      .select("id, title, description")
      .eq("id", data.pathId)
      .maybeSingle();
    if (!path) return null;

    const { data: links } = await supabase
      .from("learning_path_courses")
      .select("course_id, order_index")
      .eq("path_id", path.id)
      .order("order_index");

    const ids = (links ?? []).map((l) => l.course_id);
    const [{ data: courses }, { data: languages }, { data: sections }, { data: lessons }] = await Promise.all([
      ids.length
        ? supabase.from("courses").select("id, title, description, language_id").in("id", ids)
        : Promise.resolve({ data: [] as never[] }),
      supabase.from("languages").select("id, name"),
      supabase.from("course_sections").select("id, course_id"),
      supabase.from("course_lessons").select("id, section_id").limit(2000),
    ]);

    const sectionToCourse = new Map((sections ?? []).map((s) => [s.id, s.course_id]));
    const lessonsPerCourse = new Map<string, number>();
    for (const l of lessons ?? []) {
      const cid = sectionToCourse.get(l.section_id);
      if (cid) lessonsPerCourse.set(cid, (lessonsPerCourse.get(cid) ?? 0) + 1);
    }

    return {
      id: path.id,
      title: path.title,
      description: path.description,
      courses: (links ?? [])
        .map((link) => {
          const c = (courses ?? []).find((x) => x.id === link.course_id);
          if (!c) return null;
          return {
            id: c.id,
            title: c.title,
            description: c.description,
            language_name: (languages ?? []).find((l) => l.id === c.language_id)?.name ?? null,
            lesson_count: lessonsPerCourse.get(c.id) ?? 0,
            order_index: link.order_index,
          };
        })
        .filter((c): c is PathCourse => Boolean(c)),
    };
  });

export const getCertificate = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => ({ code: String(input.code).slice(0, 40) }))
  .handler(async ({ data }): Promise<CertificateView | null> => {
    const supabase = serverPublicClient();
    const { data: cert } = await supabase
      .from("certificates")
      .select("certificate_code, issued_at, user_id, course_id")
      .eq("certificate_code", data.code)
      .maybeSingle();
    if (!cert) return null;

    const [{ data: course }, { data: profile }] = await Promise.all([
      supabase.from("courses").select("title, description").eq("id", cert.course_id).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", cert.user_id).maybeSingle(),
    ]);

    return {
      certificate_code: cert.certificate_code,
      issued_at: cert.issued_at,
      course_title: course?.title ?? "Course",
      course_description: course?.description ?? null,
      full_name: profile?.full_name ?? null,
    };
  });

export const getUserCertificates = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => ({ userId: String(input.userId) }))
  .handler(
    async ({ data }): Promise<{ code: string; issued_at: string; course_title: string }[]> => {
      const supabase = serverPublicClient();
      const { data: certs } = await supabase
        .from("certificates")
        .select("certificate_code, issued_at, course_id")
        .eq("user_id", data.userId)
        .order("issued_at", { ascending: false });
      if (!certs?.length) return [];
      const { data: courses } = await supabase
        .from("courses")
        .select("id, title")
        .in("id", certs.map((c) => c.course_id));
      return certs.map((c) => ({
        code: c.certificate_code,
        issued_at: c.issued_at,
        course_title: (courses ?? []).find((x) => x.id === c.course_id)?.title ?? "Course",
      }));
    },
  );
