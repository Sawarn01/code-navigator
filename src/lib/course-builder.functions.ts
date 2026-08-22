import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BuilderResource = {
  id: string;
  title: string;
  file_url: string;
  type: string;
  order_index: number;
};

export type BuilderLesson = {
  id: string;
  title: string;
  youtube_video_id: string | null;
  order_index: number;
  has_practice: boolean;
  practice_topic: string | null;
  duration_minutes: number;
  resources: BuilderResource[];
  drip_after_days: number | null;
  release_at: string | null;
};

export type BuilderSection = {
  id: string;
  title: string;
  order_index: number;
  lessons: BuilderLesson[];
};

export type BuilderCourse = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  language_id: string | null;
  sections: BuilderSection[];
  prerequisiteIds: string[];
};

async function assertStaff(
  supabase: { rpc: (fn: "is_staff", args: { _user_id: string }) => Promise<{ data: unknown }> },
  userId: string,
) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (data !== true) throw new Error("Forbidden: manager or admin role required");
}

export const listBuilderCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      courses: { id: string; title: string; language_id: string | null }[];
      languages: { id: string; name: string }[];
    }> => {
      await assertStaff(context.supabase as never, context.userId);
      const [{ data: courses }, { data: languages }] = await Promise.all([
        context.supabase.from("courses").select("id, title, language_id").order("title"),
        context.supabase.from("languages").select("id, name").order("name"),
      ]);
      return { courses: courses ?? [], languages: languages ?? [] };
    },
  );

export const getBuilderCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => ({ courseId: String(input.courseId) }))
  .handler(async ({ context, data }): Promise<BuilderCourse | null> => {
    await assertStaff(context.supabase as never, context.userId);
    const { data: course } = await context.supabase
      .from("courses")
      .select("id, title, description, thumbnail_url, language_id")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course) return null;

    const { data: sections } = await context.supabase
      .from("course_sections")
      .select("id, title, order_index")
      .eq("course_id", course.id)
      .order("order_index");

    const sectionIds = (sections ?? []).map((s) => s.id);
    const { data: lessons } = sectionIds.length
      ? await context.supabase
          .from("course_lessons")
          .select(
            "id, section_id, title, youtube_video_id, order_index, has_practice, practice_topic, duration_minutes, drip_after_days, release_at",
          )
          .in("section_id", sectionIds)
          .order("order_index")
      : { data: [] as never[] };

    const lessonIds = (lessons ?? []).map((l) => l.id);
    const [{ data: resources }, { data: prereqLinks }] = await Promise.all([
      lessonIds.length
        ? context.supabase
            .from("lesson_resources")
            .select("id, lesson_id, title, file_url, type, order_index")
            .in("lesson_id", lessonIds)
            .order("order_index")
        : Promise.resolve({
            data: [] as {
              id: string;
              lesson_id: string;
              title: string;
              file_url: string;
              type: string;
              order_index: number;
            }[],
          }),
      context.supabase
        .from("course_prerequisites")
        .select("prerequisite_course_id")
        .eq("course_id", course.id),
    ]);

    return {
      ...course,
      prerequisiteIds: (prereqLinks ?? []).map((p) => p.prerequisite_course_id),
      sections: (sections ?? []).map((s) => ({
        ...s,
        lessons: (lessons ?? [])
          .filter((l) => l.section_id === s.id)
          .map(({ section_id: _s, ...rest }) => ({
            ...rest,
            resources: (resources ?? [])
              .filter((r) => r.lesson_id === rest.id)
              .map(({ lesson_id: _l, ...r }) => r),
          })),
      })),
    };
  });

export const saveCoursePrerequisites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string; prerequisiteIds: string[] }) => ({
    courseId: String(input.courseId),
    prerequisiteIds: [...new Set((input.prerequisiteIds ?? []).map(String))]
      .filter((id) => id !== String(input.courseId))
      .slice(0, 20),
  }))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertStaff(context.supabase as never, context.userId);
    await context.supabase.from("course_prerequisites").delete().eq("course_id", data.courseId);
    if (data.prerequisiteIds.length) {
      const { error } = await context.supabase.from("course_prerequisites").insert(
        data.prerequisiteIds.map((prerequisite_course_id) => ({
          course_id: data.courseId,
          prerequisite_course_id,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const saveCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      title: string;
      description?: string | null;
      thumbnail_url?: string | null;
      language_id?: string | null;
    }) => ({
      id: input.id ? String(input.id) : null,
      title: String(input.title).slice(0, 200),
      description: input.description ? String(input.description).slice(0, 2000) : null,
      thumbnail_url: input.thumbnail_url ? String(input.thumbnail_url).slice(0, 500) : null,
      language_id: input.language_id ? String(input.language_id) : null,
    }),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    await assertStaff(context.supabase as never, context.userId);
    const payload = {
      title: data.title,
      description: data.description,
      thumbnail_url: data.thumbnail_url,
      language_id: data.language_id,
    };
    if (data.id) {
      const { error } = await context.supabase.from("courses").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("courses")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => ({ courseId: String(input.courseId) }))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { error } = await context.supabase.from("courses").delete().eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id?: string | null; courseId: string; title: string; order_index?: number }) => ({
      id: input.id ? String(input.id) : null,
      courseId: String(input.courseId),
      title: String(input.title).slice(0, 200),
      order_index: Number(input.order_index ?? 0),
    }),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    await assertStaff(context.supabase as never, context.userId);
    if (data.id) {
      const { error } = await context.supabase
        .from("course_sections")
        .update({ title: data.title })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("course_sections")
      .insert({ course_id: data.courseId, title: data.title, order_index: data.order_index })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sectionId: string }) => ({ sectionId: String(input.sectionId) }))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from("course_sections")
      .delete()
      .eq("id", data.sectionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      sectionId: string;
      title: string;
      youtube_video_id?: string | null;
      has_practice?: boolean;
      practice_topic?: string | null;
      duration_minutes?: number;
      order_index?: number;
      drip_after_days?: number | null;
      release_at?: string | null;
    }) => ({
      id: input.id ? String(input.id) : null,
      sectionId: String(input.sectionId),
      title: String(input.title).slice(0, 200),
      youtube_video_id: input.youtube_video_id ? String(input.youtube_video_id).slice(0, 60) : null,
      has_practice: Boolean(input.has_practice),
      practice_topic: input.practice_topic ? String(input.practice_topic).slice(0, 120) : null,
      duration_minutes: Math.max(0, Math.min(600, Number(input.duration_minutes ?? 10))),
      order_index: Number(input.order_index ?? 0),
      drip_after_days:
        input.drip_after_days === null || input.drip_after_days === undefined
          ? null
          : Math.max(0, Math.round(Number(input.drip_after_days))),
      release_at: input.release_at ? new Date(input.release_at).toISOString() : null,
    }),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    await assertStaff(context.supabase as never, context.userId);
    const payload = {
      title: data.title,
      youtube_video_id: data.youtube_video_id,
      has_practice: data.has_practice,
      practice_topic: data.practice_topic,
      duration_minutes: data.duration_minutes,
      drip_after_days: data.drip_after_days,
      release_at: data.release_at,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("course_lessons")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("course_lessons")
      .insert({ ...payload, section_id: data.sectionId, order_index: data.order_index })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string }) => ({ lessonId: String(input.lessonId) }))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from("course_lessons")
      .delete()
      .eq("id", data.lessonId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: "section" | "lesson" | "resource"; ids: string[] }) => ({
    kind: input.kind,
    ids: (input.ids ?? []).map(String).slice(0, 300),
  }))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase as never, context.userId);
    const table =
      data.kind === "section"
        ? "course_sections"
        : data.kind === "lesson"
          ? "course_lessons"
          : "lesson_resources";
    for (let i = 0; i < data.ids.length; i += 1) {
      const { error } = await context.supabase
        .from(table)
        .update({ order_index: i })
        .eq("id", data.ids[i]!);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const saveResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      lessonId: string;
      title: string;
      file_url: string;
      type: string;
      order_index?: number;
    }) => ({
      id: input.id ? String(input.id) : null,
      lessonId: String(input.lessonId),
      title: String(input.title).slice(0, 200),
      file_url: String(input.file_url).slice(0, 800),
      type: ["pdf", "slides", "link", "code"].includes(input.type) ? input.type : "link",
      order_index: Number(input.order_index ?? 0),
    }),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    await assertStaff(context.supabase as never, context.userId);
    const payload = { title: data.title, file_url: data.file_url, type: data.type };
    if (data.id) {
      const { error } = await context.supabase
        .from("lesson_resources")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("lesson_resources")
      .insert({ ...payload, lesson_id: data.lessonId, order_index: data.order_index })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resourceId: string }) => ({ resourceId: String(input.resourceId) }))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from("lesson_resources")
      .delete()
      .eq("id", data.resourceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type CourseImpact = {
  course_id: string;
  lessons: number;
  learners: number;
  completion_rate: number;
};

/** Enrollment + completion stats so staff can see the impact before deleting a course. */
export const getCourseImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ stats: CourseImpact[] }> => {
    await assertStaff(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: sections }, { data: lessons }, { data: progress }] = await Promise.all([
      supabaseAdmin.from("course_sections").select("id, course_id").limit(5000),
      supabaseAdmin.from("course_lessons").select("id, section_id").limit(10000),
      // "completed" only exists since Wave 7's watch-time tracking started
      // creating in-progress rows too — without this filter, a learner who
      // merely started every lesson would be miscounted as having finished.
      supabaseAdmin.from("lesson_progress").select("user_id, lesson_id, completed").limit(50000),
    ]);

    const courseBySection = new Map((sections ?? []).map((s) => [s.id, s.course_id] as const));
    const courseByLesson = new Map<string, string>();
    const lessonsPerCourse = new Map<string, number>();
    for (const l of lessons ?? []) {
      const courseId = courseBySection.get(l.section_id);
      if (!courseId) continue;
      courseByLesson.set(l.id, courseId);
      lessonsPerCourse.set(courseId, (lessonsPerCourse.get(courseId) ?? 0) + 1);
    }

    const engagedByCourseUser = new Set<string>();
    const doneByCourseUser = new Map<string, number>();
    for (const p of progress ?? []) {
      const courseId = courseByLesson.get(p.lesson_id);
      if (!courseId) continue;
      const key = `${courseId}|${p.user_id}`;
      engagedByCourseUser.add(key);
      if (p.completed) doneByCourseUser.set(key, (doneByCourseUser.get(key) ?? 0) + 1);
    }

    const learners = new Map<string, number>();
    for (const key of engagedByCourseUser) {
      const courseId = key.split("|")[0]!;
      learners.set(courseId, (learners.get(courseId) ?? 0) + 1);
    }

    const finishers = new Map<string, number>();
    for (const [key, done] of doneByCourseUser) {
      const courseId = key.split("|")[0]!;
      const total = lessonsPerCourse.get(courseId) ?? 0;
      if (total > 0 && done >= total) finishers.set(courseId, (finishers.get(courseId) ?? 0) + 1);
    }

    return {
      stats: [...lessonsPerCourse.keys()].map((courseId) => {
        const l = learners.get(courseId) ?? 0;
        return {
          course_id: courseId,
          lessons: lessonsPerCourse.get(courseId) ?? 0,
          learners: l,
          completion_rate: l ? Math.round((100 * (finishers.get(courseId) ?? 0)) / l) : 0,
        };
      }),
    };
  });
