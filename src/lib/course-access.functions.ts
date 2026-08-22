import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverPublicClient } from "@/lib/supabase-server";

export type CoursePrerequisite = { id: string; title: string; completed: boolean };
export type LessonAccess = { lessonId: string; unlocked: boolean; unlocksAt: string | null };

export type CourseAccess = {
  unlocked: boolean;
  prerequisites: CoursePrerequisite[];
  lessons: LessonAccess[];
};

/** Public: prerequisite course titles for a course, regardless of any viewer's progress. */
export const getCoursePrerequisites = createServerFn({ method: "POST" })
  .inputValidator((input: { courseId: string }) => ({ courseId: String(input.courseId) }))
  .handler(async ({ data }): Promise<{ id: string; title: string }[]> => {
    const supabase = serverPublicClient();
    const { data: links } = await supabase
      .from("course_prerequisites")
      .select("prerequisite_course_id")
      .eq("course_id", data.courseId);
    const ids = (links ?? []).map((l) => l.prerequisite_course_id);
    if (!ids.length) return [];
    const { data: courses } = await supabase.from("courses").select("id, title").in("id", ids);
    return courses ?? [];
  });

/**
 * Auto-enrolls the viewer (no payment/approval gate exists), then reports
 * whether the course is unlocked (prerequisites met) and which lessons are
 * still drip-locked for them.
 */
export const getMyCourseAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => ({ courseId: String(input.courseId) }))
  .handler(async ({ context, data }): Promise<CourseAccess> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: enrollment, error: enrollError } = await context.supabase
      .from("course_enrollments")
      .upsert(
        { user_id: context.userId, course_id: data.courseId },
        { onConflict: "user_id,course_id", ignoreDuplicates: true },
      )
      .select("enrolled_at")
      .maybeSingle();
    if (enrollError) throw new Error(enrollError.message);

    let enrolledAt = enrollment?.enrolled_at ?? null;
    if (!enrolledAt) {
      const { data: existing } = await context.supabase
        .from("course_enrollments")
        .select("enrolled_at")
        .eq("user_id", context.userId)
        .eq("course_id", data.courseId)
        .maybeSingle();
      enrolledAt = existing?.enrolled_at ?? new Date().toISOString();
    }

    const { data: unlocked } = await context.supabase.rpc("is_course_unlocked", {
      _user_id: context.userId,
      _course_id: data.courseId,
    });

    const { data: links } = await supabaseAdmin
      .from("course_prerequisites")
      .select("prerequisite_course_id")
      .eq("course_id", data.courseId);
    const prereqIds = (links ?? []).map((l) => l.prerequisite_course_id);

    const prerequisites: CoursePrerequisite[] = [];
    if (prereqIds.length) {
      const { data: courses } = await supabaseAdmin
        .from("courses")
        .select("id, title")
        .in("id", prereqIds);
      for (const c of courses ?? []) {
        const { data: sections } = await supabaseAdmin
          .from("course_sections")
          .select("id")
          .eq("course_id", c.id);
        const sectionIds = (sections ?? []).map((s) => s.id);
        const total = sectionIds.length
          ? ((
              await supabaseAdmin
                .from("course_lessons")
                .select("id", { count: "exact", head: true })
                .in("section_id", sectionIds)
            ).count ?? 0)
          : 0;
        let done = 0;
        if (sectionIds.length) {
          const { data: lessonIds } = await supabaseAdmin
            .from("course_lessons")
            .select("id")
            .in("section_id", sectionIds);
          const ids = (lessonIds ?? []).map((l) => l.id);
          if (ids.length) {
            done =
              (
                await context.supabase
                  .from("lesson_progress")
                  .select("lesson_id", { count: "exact", head: true })
                  .eq("user_id", context.userId)
                  .eq("completed", true)
                  .in("lesson_id", ids)
              ).count ?? 0;
          }
        }
        prerequisites.push({ id: c.id, title: c.title, completed: total > 0 && done >= total });
      }
    }

    const { data: sections } = await supabaseAdmin
      .from("course_sections")
      .select("id")
      .eq("course_id", data.courseId);
    const sectionIds = (sections ?? []).map((s) => s.id);
    const { data: lessons } = sectionIds.length
      ? await supabaseAdmin
          .from("course_lessons")
          .select("id, drip_after_days, release_at")
          .in("section_id", sectionIds)
      : { data: [] as { id: string; drip_after_days: number | null; release_at: string | null }[] };

    const lessonAccess: LessonAccess[] = (lessons ?? []).map((l) => {
      let unlocksAt: string | null = l.release_at ?? null;
      if (!unlocksAt && l.drip_after_days != null) {
        unlocksAt = new Date(
          new Date(enrolledAt!).getTime() + l.drip_after_days * 86400000,
        ).toISOString();
      }
      return {
        lessonId: l.id,
        unlocked: !unlocksAt || new Date(unlocksAt).getTime() <= Date.now(),
        unlocksAt,
      };
    });

    return { unlocked: (unlocked as boolean | null) ?? true, prerequisites, lessons: lessonAccess };
  });
