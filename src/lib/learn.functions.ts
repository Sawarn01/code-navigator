import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverPublicClient } from "@/lib/supabase-server";

export type CourseSummary = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  language_id: string | null;
  language_name: string | null;
  language_slug: string | null;
  lesson_count: number;
  total_minutes: number;
};

export type CourseLesson = {
  id: string;
  title: string;
  youtube_video_id: string | null;
  order_index: number;
  has_practice: boolean;
  practice_topic: string | null;
  duration_minutes: number;
};

export type CourseSection = {
  id: string;
  title: string;
  order_index: number;
  lessons: CourseLesson[];
};

export type CourseDetail = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  language_id: string | null;
  language_name: string | null;
  language_slug: string | null;
  sections: CourseSection[];
};

export const getCourses = createServerFn({ method: "GET" }).handler(
  async (): Promise<CourseSummary[]> => {
    const supabase = serverPublicClient();
    const [{ data: courses }, { data: languages }, { data: sections }, { data: lessons }] =
      await Promise.all([
        supabase
          .from("courses")
          .select("id, title, description, thumbnail_url, language_id")
          .order("title"),
        supabase.from("languages").select("id, name, slug"),
        supabase.from("course_sections").select("id, course_id"),
        supabase.from("course_lessons").select("id, section_id, duration_minutes").limit(2000),
      ]);

    const sectionToCourse = new Map((sections ?? []).map((s) => [s.id, s.course_id]));
    const counts = new Map<string, { lessons: number; minutes: number }>();
    for (const lesson of lessons ?? []) {
      const courseId = sectionToCourse.get(lesson.section_id);
      if (!courseId) continue;
      const entry = counts.get(courseId) ?? { lessons: 0, minutes: 0 };
      entry.lessons += 1;
      entry.minutes += lesson.duration_minutes ?? 0;
      counts.set(courseId, entry);
    }

    return (courses ?? []).map((c) => {
      const lang = (languages ?? []).find((l) => l.id === c.language_id);
      const stat = counts.get(c.id) ?? { lessons: 0, minutes: 0 };
      return {
        ...c,
        language_name: lang?.name ?? null,
        language_slug: lang?.slug ?? null,
        lesson_count: stat.lessons,
        total_minutes: stat.minutes,
      };
    });
  },
);

export const getCourse = createServerFn({ method: "POST" })
  .inputValidator((input: { courseId: string }) => ({ courseId: String(input.courseId) }))
  .handler(async ({ data }): Promise<CourseDetail | null> => {
    const supabase = serverPublicClient();
    const { data: course } = await supabase
      .from("courses")
      .select("id, title, description, thumbnail_url, language_id")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course) return null;

    const [{ data: sections }, { data: languages }] = await Promise.all([
      supabase
        .from("course_sections")
        .select("id, title, order_index")
        .eq("course_id", course.id)
        .order("order_index"),
      supabase.from("languages").select("id, name, slug"),
    ]);

    const sectionIds = (sections ?? []).map((s) => s.id);
    const { data: lessons } = sectionIds.length
      ? await supabase
          .from("course_lessons")
          .select(
            "id, section_id, title, youtube_video_id, order_index, has_practice, practice_topic, duration_minutes",
          )
          .in("section_id", sectionIds)
          .order("order_index")
      : { data: [] as never[] };

    const lang = (languages ?? []).find((l) => l.id === course.language_id);

    return {
      ...course,
      language_name: lang?.name ?? null,
      language_slug: lang?.slug ?? null,
      sections: (sections ?? []).map((s) => ({
        ...s,
        lessons: (lessons ?? [])
          .filter((l) => l.section_id === s.id)
          .map(({ section_id: _section_id, ...rest }) => rest as CourseLesson),
      })),
    };
  });

export const getMyLessonProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ completed: string[] }> => {
    const { data } = await context.supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", context.userId)
      .limit(2000);
    return { completed: (data ?? []).map((r) => r.lesson_id) };
  });

export const setLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; completed: boolean }) => ({
    lessonId: String(input.lessonId),
    completed: Boolean(input.completed),
  }))
  .handler(async ({ context, data }) => {
    if (data.completed) {
      const { error } = await context.supabase
        .from("lesson_progress")
        .insert({ user_id: context.userId, lesson_id: data.lessonId });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("lesson_progress")
        .delete()
        .eq("user_id", context.userId)
        .eq("lesson_id", data.lessonId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
