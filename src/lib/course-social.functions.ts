import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverPublicClient } from "@/lib/supabase-server";

export type LessonComment = {
  id: string;
  body: string;
  upvotes: number;
  created_at: string;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  is_instructor: boolean;
};

export type LessonResource = {
  id: string;
  title: string;
  file_url: string;
  type: string;
};

export type CourseReview = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
};

export type CourseRatingSummary = {
  average: number;
  count: number;
  breakdown: Record<number, number>;
};

export const getLessonThread = createServerFn({ method: "POST" })
  .inputValidator((input: { lessonId: string }) => ({ lessonId: String(input.lessonId) }))
  .handler(
    async ({
      data,
    }): Promise<{ comments: LessonComment[]; resources: LessonResource[] }> => {
      const supabase = serverPublicClient();
      const [{ data: comments }, { data: resources }] = await Promise.all([
        supabase
          .from("lesson_comments")
          .select("id, body, upvotes, created_at, user_id")
          .eq("lesson_id", data.lessonId)
          .order("upvotes", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("lesson_resources")
          .select("id, title, file_url, type")
          .eq("lesson_id", data.lessonId)
          .order("order_index"),
      ]);

      const userIds = [...new Set((comments ?? []).map((c) => c.user_id))];
      const [{ data: profiles }, { data: roles }] = userIds.length
        ? await Promise.all([
            supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
            supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
          ])
        : [{ data: [] as never[] }, { data: [] as never[] }];

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
      const staffIds = new Set(
        (roles ?? []).filter((r) => r.role === "admin" || r.role === "manager").map((r) => r.user_id),
      );

      return {
        comments: (comments ?? []).map((c) => ({
          ...c,
          author_name: profileById.get(c.user_id)?.full_name ?? null,
          author_avatar: profileById.get(c.user_id)?.avatar_url ?? null,
          is_instructor: staffIds.has(c.user_id),
        })),
        resources: resources ?? [],
      };
    },
  );

export const postLessonComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lessonId: string; body: string }) => ({
    lessonId: String(input.lessonId),
    body: String(input.body).trim().slice(0, 4000),
  }))
  .handler(async ({ context, data }) => {
    if (!data.body) throw new Error("Comment cannot be empty");
    const { error } = await context.supabase
      .from("lesson_comments")
      .insert({ lesson_id: data.lessonId, user_id: context.userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLessonComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { commentId: string }) => ({ commentId: String(input.commentId) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("lesson_comments")
      .delete()
      .eq("id", data.commentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleCommentVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { commentId: string }) => ({ commentId: String(input.commentId) }))
  .handler(async ({ context, data }): Promise<{ voted: boolean }> => {
    const { data: existing } = await context.supabase
      .from("lesson_comment_votes")
      .select("id")
      .eq("comment_id", data.commentId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      const { error } = await context.supabase
        .from("lesson_comment_votes")
        .delete()
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { voted: false };
    }
    const { error } = await context.supabase
      .from("lesson_comment_votes")
      .insert({ comment_id: data.commentId, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { voted: true };
  });

export const getMyCommentVotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ commentIds: string[] }> => {
    const { data } = await context.supabase
      .from("lesson_comment_votes")
      .select("comment_id")
      .eq("user_id", context.userId)
      .limit(2000);
    return { commentIds: (data ?? []).map((r) => r.comment_id) };
  });

export const getCourseReviews = createServerFn({ method: "POST" })
  .inputValidator((input: { courseId: string }) => ({ courseId: String(input.courseId) }))
  .handler(
    async ({ data }): Promise<{ reviews: CourseReview[]; summary: CourseRatingSummary }> => {
      const supabase = serverPublicClient();
      const { data: reviews } = await supabase
        .from("course_reviews")
        .select("id, rating, review_text, created_at, user_id")
        .eq("course_id", data.courseId)
        .order("created_at", { ascending: false })
        .limit(200);

      const userIds = [...new Set((reviews ?? []).map((r) => r.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds)
        : { data: [] as never[] };
      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

      const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let total = 0;
      for (const r of reviews ?? []) {
        breakdown[r.rating] = (breakdown[r.rating] ?? 0) + 1;
        total += r.rating;
      }
      const count = (reviews ?? []).length;

      return {
        reviews: (reviews ?? []).map((r) => ({
          ...r,
          author_name: profileById.get(r.user_id)?.full_name ?? null,
          author_avatar: profileById.get(r.user_id)?.avatar_url ?? null,
        })),
        summary: {
          average: count ? Math.round((total / count) * 10) / 10 : 0,
          count,
          breakdown,
        },
      };
    },
  );

export const getCourseRatings = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, { average: number; count: number }>> => {
    const supabase = serverPublicClient();
    const { data } = await supabase.from("course_reviews").select("course_id, rating").limit(5000);
    const agg: Record<string, { sum: number; count: number }> = {};
    for (const r of data ?? []) {
      const entry = agg[r.course_id] ?? { sum: 0, count: 0 };
      entry.sum += r.rating;
      entry.count += 1;
      agg[r.course_id] = entry;
    }
    const out: Record<string, { average: number; count: number }> = {};
    for (const [id, v] of Object.entries(agg)) {
      out[id] = { average: Math.round((v.sum / v.count) * 10) / 10, count: v.count };
    }
    return out;
  },
);

export const upsertCourseReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string; rating: number; review_text?: string | null }) => ({
    courseId: String(input.courseId),
    rating: Math.max(1, Math.min(5, Math.round(Number(input.rating)))),
    review_text: input.review_text ? String(input.review_text).trim().slice(0, 2000) : null,
  }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("course_reviews").upsert(
      {
        course_id: data.courseId,
        user_id: context.userId,
        rating: data.rating,
        review_text: data.review_text,
      },
      { onConflict: "course_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyCourseReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => ({ courseId: String(input.courseId) }))
  .handler(
    async ({ context, data }): Promise<{ rating: number; review_text: string | null } | null> => {
      const { data: review } = await context.supabase
        .from("course_reviews")
        .select("rating, review_text")
        .eq("course_id", data.courseId)
        .eq("user_id", context.userId)
        .maybeSingle();
      return review ?? null;
    },
  );
