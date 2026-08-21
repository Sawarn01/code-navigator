import { createServerFn } from "@tanstack/react-start";
import { serverPublicClient } from "@/lib/supabase-server";

export type SearchHit = {
  kind: "term" | "question" | "post" | "course";
  id: string;
  title: string;
  subtitle: string | null;
  slug: string | null;
};

export const globalSearch = createServerFn({ method: "POST" })
  .inputValidator((input: { q: string }) => ({ q: String(input?.q ?? "").trim().slice(0, 80) }))
  .handler(async ({ data }): Promise<{ hits: SearchHit[] }> => {
    if (data.q.length < 2) return { hits: [] };
    const supabase = serverPublicClient();
    const like = `%${data.q.replace(/[%_]/g, "")}%`;

    const [terms, questions, posts, courses] = await Promise.all([
      supabase.from("dictionary_terms").select("id, term, definition").ilike("term", like).limit(6),
      supabase
        .from("questions")
        .select("id, title, slug, difficulty, category")
        .ilike("title", like)
        .limit(6),
      supabase.from("forum_posts").select("id, title, tags").ilike("title", like).limit(5),
      supabase.from("courses").select("id, title, description").ilike("title", like).limit(3),
    ]);

    const hits: SearchHit[] = [
      ...(terms.data ?? []).map((t) => ({
        kind: "term" as const,
        id: t.id,
        title: t.term,
        subtitle: t.definition.slice(0, 90),
        slug: null,
      })),
      ...(questions.data ?? []).map((q) => ({
        kind: "question" as const,
        id: q.id,
        title: q.title,
        subtitle: `${q.difficulty} · ${q.category === "cp" ? "CP Zone" : "Practice"}`,
        slug: q.slug,
      })),
      ...(posts.data ?? []).map((p) => ({
        kind: "post" as const,
        id: p.id,
        title: p.title,
        subtitle: (p.tags ?? []).join(", ") || "Forum thread",
        slug: null,
      })),
      ...(courses.data ?? []).map((c) => ({
        kind: "course" as const,
        id: c.id,
        title: c.title,
        subtitle: c.description?.slice(0, 90) ?? null,
        slug: null,
      })),
    ];

    return { hits };
  });
