import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverPublicClient } from "@/lib/supabase-server";

export type ForumAuthor = { id: string; full_name: string | null; avatar_url: string | null };

export type ForumPostSummary = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  upvotes: number;
  created_at: string;
  author: ForumAuthor | null;
  reply_count: number;
  accepted_reply_id: string | null;
};

export type ForumReply = {
  id: string;
  body: string;
  upvotes: number;
  created_at: string;
  user_id: string;
  author: ForumAuthor | null;
};

export type ForumPostDetail = {
  post: (ForumPostSummary & { user_id: string }) | null;
  replies: ForumReply[];
};

async function authorsFor(
  supabase: ReturnType<typeof serverPublicClient>,
  ids: string[],
): Promise<Map<string, ForumAuthor>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p as ForumAuthor]));
}

export const listForumPosts = createServerFn({ method: "GET" }).handler(
  async (): Promise<ForumPostSummary[]> => {
    const supabase = serverPublicClient();
    const { data: posts } = await supabase
      .from("forum_posts")
      .select("id, user_id, title, body, tags, upvotes, created_at, accepted_reply_id")
      .order("created_at", { ascending: false })
      .limit(100);

    const rows = posts ?? [];
    if (rows.length === 0) return [];

    const [authors, { data: replies }] = await Promise.all([
      authorsFor(
        supabase,
        rows.map((r) => r.user_id),
      ),
      supabase
        .from("forum_replies")
        .select("post_id")
        .in(
          "post_id",
          rows.map((r) => r.id),
        ),
    ]);

    const counts = new Map<string, number>();
    for (const r of replies ?? []) {
      counts.set(r.post_id, (counts.get(r.post_id) ?? 0) + 1);
    }

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      tags: r.tags ?? [],
      upvotes: r.upvotes ?? 0,
      created_at: r.created_at,
      author: authors.get(r.user_id) ?? null,
      reply_count: counts.get(r.id) ?? 0,
    }));
  },
);

/** Discussion thread scoped to one practice/CP question. */
export const listQuestionDiscussion = createServerFn({ method: "POST" })
  .inputValidator((input: { questionId: string }) => ({ questionId: String(input.questionId) }))
  .handler(async ({ data }): Promise<ForumPostSummary[]> => {
    const supabase = serverPublicClient();
    const { data: posts } = await supabase
      .from("forum_posts")
      .select("id, user_id, title, body, tags, upvotes, created_at, accepted_reply_id")
      .eq("question_id", data.questionId)
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = posts ?? [];
    if (rows.length === 0) return [];

    const [authors, { data: replies }] = await Promise.all([
      authorsFor(
        supabase,
        rows.map((r) => r.user_id),
      ),
      supabase
        .from("forum_replies")
        .select("post_id")
        .in(
          "post_id",
          rows.map((r) => r.id),
        ),
    ]);

    const counts = new Map<string, number>();
    for (const r of replies ?? []) {
      counts.set(r.post_id, (counts.get(r.post_id) ?? 0) + 1);
    }

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      tags: r.tags ?? [],
      upvotes: r.upvotes ?? 0,
      created_at: r.created_at,
      author: authors.get(r.user_id) ?? null,
      reply_count: counts.get(r.id) ?? 0,
      accepted_reply_id: r.accepted_reply_id,
    }));
  });

export const getForumPost = createServerFn({ method: "GET" })
  .inputValidator((input: { postId: string }) => ({ postId: String(input.postId) }))
  .handler(async ({ data }): Promise<ForumPostDetail> => {
    const supabase = serverPublicClient();
    const { data: post } = await supabase
      .from("forum_posts")
      .select("id, user_id, title, body, tags, upvotes, created_at, accepted_reply_id")
      .eq("id", data.postId)
      .maybeSingle();

    if (!post) return { post: null, replies: [] };

    const { data: replies } = await supabase
      .from("forum_replies")
      .select("id, user_id, body, upvotes, created_at")
      .eq("post_id", data.postId)
      .order("created_at", { ascending: true });

    const rows = replies ?? [];
    const authors = await authorsFor(supabase, [post.user_id, ...rows.map((r) => r.user_id)]);

    return {
      post: {
        id: post.id,
        user_id: post.user_id,
        title: post.title,
        body: post.body,
        tags: post.tags ?? [],
        upvotes: post.upvotes ?? 0,
        created_at: post.created_at,
        author: authors.get(post.user_id) ?? null,
        reply_count: rows.length,
        accepted_reply_id: post.accepted_reply_id,
      },
      replies: rows.map((r) => ({
        id: r.id,
        body: r.body,
        upvotes: r.upvotes ?? 0,
        created_at: r.created_at,
        user_id: r.user_id,
        author: authors.get(r.user_id) ?? null,
      })),
    };
  });

export const getMyVotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ posts: string[]; replies: string[] }> => {
    const { data } = await context.supabase
      .from("forum_votes")
      .select("post_id, reply_id")
      .eq("user_id", context.userId);
    return {
      posts: (data ?? []).map((v) => v.post_id).filter((v): v is string => Boolean(v)),
      replies: (data ?? []).map((v) => v.reply_id).filter((v): v is string => Boolean(v)),
    };
  });

export const toggleVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId?: string; replyId?: string }) => ({
    postId: input.postId ? String(input.postId) : null,
    replyId: input.replyId ? String(input.replyId) : null,
  }))
  .handler(async ({ data, context }): Promise<{ voted: boolean }> => {
    if (!data.postId && !data.replyId) throw new Error("Nothing to vote on");
    const { supabase, userId } = context;

    let query = supabase.from("forum_votes").select("id").eq("user_id", userId);
    query = data.postId ? query.eq("post_id", data.postId) : query.eq("reply_id", data.replyId!);
    const { data: existing } = await query.maybeSingle();

    if (existing) {
      const { error } = await supabase.from("forum_votes").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { voted: false };
    }

    const { error } = await supabase.from("forum_votes").insert({
      user_id: userId,
      post_id: data.postId,
      reply_id: data.replyId,
    });
    if (error) throw new Error(error.message);
    return { voted: true };
  });

export const createForumPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { title: string; body: string; tags: string[]; questionId?: string | null }) => {
      const title = String(input.title ?? "").trim();
      const body = String(input.body ?? "").trim();
      if (title.length < 5 || title.length > 150) throw new Error("Title must be 5-150 characters");
      if (body.length < 10 || body.length > 8000)
        throw new Error("Body must be 10-8000 characters");
      const tags = (Array.isArray(input.tags) ? input.tags : [])
        .map((t) => String(t).trim().toLowerCase().slice(0, 24))
        .filter(Boolean)
        .slice(0, 5);
      return { title, body, tags, questionId: input.questionId ? String(input.questionId) : null };
    },
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: row, error } = await context.supabase
      .from("forum_posts")
      .insert({
        title: data.title,
        body: data.body,
        tags: data.tags,
        question_id: data.questionId,
        user_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const createForumReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string; body: string }) => {
    const body = String(input.body ?? "").trim();
    if (body.length < 2 || body.length > 5000) throw new Error("Reply must be 2-5000 characters");
    return { postId: String(input.postId), body };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("forum_replies").insert({
      post_id: data.postId,
      user_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Author-or-staff only (enforced by the same "users update own posts" RLS policy as edits). */
export const acceptReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string; replyId: string | null }) => ({
    postId: String(input.postId),
    replyId: input.replyId ? String(input.replyId) : null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (data.replyId) {
      const { data: reply } = await context.supabase
        .from("forum_replies")
        .select("post_id")
        .eq("id", data.replyId)
        .maybeSingle();
      if (!reply || reply.post_id !== data.postId) {
        throw new Error("That reply does not belong to this post");
      }
    }

    const { data: updated, error } = await context.supabase
      .from("forum_posts")
      .update({ accepted_reply_id: data.replyId })
      .eq("id", data.postId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Forbidden: only the post author or staff can accept an answer");
    return { ok: true };
  });

export const deleteForumPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string }) => ({ postId: String(input.postId) }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("forum_posts").delete().eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateForumPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string; title: string; body: string }) => ({
    postId: String(input.postId),
    title: String(input.title ?? "")
      .trim()
      .slice(0, 150),
    body: String(input.body ?? "")
      .trim()
      .slice(0, 8000),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("forum_posts")
      .update({ title: data.title, body: data.body })
      .eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteForumReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { replyId: string }) => ({ replyId: String(input.replyId) }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("forum_replies").delete().eq("id", data.replyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
