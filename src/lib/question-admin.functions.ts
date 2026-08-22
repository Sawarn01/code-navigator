import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminQuestionRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  difficulty: string;
  points: number;
  language_id: string | null;
  is_archived: boolean;
  submissions: number;
  test_cases: number;
  topics: string[];
};

export type AdminTestCase = {
  id?: string;
  input: string;
  expected_output: string;
  is_sample: boolean;
};

export type AdminHint = {
  id?: string;
  hint_text: string;
  points_penalty: number;
};

export type AdminQuestionDetail = {
  id: string;
  title: string;
  slug: string;
  category: string;
  difficulty: string;
  description: string;
  constraints: string | null;
  starter_code: string | null;
  points: number;
  language_id: string | null;
  time_limit_ms: number;
  memory_limit_mb: number;
  sql_setup: string | null;
  sample_table: string | null;
  is_archived: boolean;
  submissions: number;
  testCases: AdminTestCase[];
  topicIds: string[];
  editorial: string | null;
  editorial_video_id: string | null;
  hints: AdminHint[];
};

async function assertStaff(
  supabase: { rpc: (fn: "is_staff", args: { _user_id: string }) => Promise<{ data: unknown }> },
  userId: string,
) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (data !== true) throw new Error("Forbidden: manager or admin role required");
}

export const listAdminQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      questions: AdminQuestionRow[];
      languages: { id: string; name: string; slug: string }[];
      topics: { id: string; name: string; slug: string }[];
    }> => {
      await assertStaff(context.supabase as never, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [
        { data: questions },
        { data: languages },
        { data: topics },
        { data: links },
        { data: subs },
        { data: tests },
      ] = await Promise.all([
        supabaseAdmin
          .from("questions")
          .select("id, title, slug, category, difficulty, points, language_id, is_archived")
          .order("title")
          .limit(1000),
        supabaseAdmin.from("languages").select("id, name, slug").order("name"),
        supabaseAdmin.from("topics").select("id, name, slug").order("order_index"),
        supabaseAdmin.from("question_topics").select("question_id, topic_id").limit(5000),
        supabaseAdmin.from("submissions").select("question_id").limit(10000),
        supabaseAdmin.from("test_cases").select("question_id").limit(10000),
      ]);

      const topicNameById = new Map((topics ?? []).map((t) => [t.id, t.name] as const));
      const topicsByQuestion = new Map<string, string[]>();
      for (const l of links ?? []) {
        const name = topicNameById.get(l.topic_id);
        if (!name) continue;
        topicsByQuestion.set(l.question_id, [...(topicsByQuestion.get(l.question_id) ?? []), name]);
      }
      const count = (rows: { question_id: string | null }[] | null) => {
        const m = new Map<string, number>();
        for (const r of rows ?? []) {
          if (!r.question_id) continue;
          m.set(r.question_id, (m.get(r.question_id) ?? 0) + 1);
        }
        return m;
      };
      const subCount = count(subs);
      const testCount = count(tests);

      return {
        questions: (questions ?? []).map((q) => ({
          ...q,
          submissions: subCount.get(q.id) ?? 0,
          test_cases: testCount.get(q.id) ?? 0,
          topics: (topicsByQuestion.get(q.id) ?? []).sort(),
        })),
        languages: languages ?? [],
        topics: topics ?? [],
      };
    },
  );

export const getAdminQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { questionId: string }) => ({ questionId: String(input.questionId) }))
  .handler(async ({ context, data }): Promise<AdminQuestionDetail | null> => {
    await assertStaff(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: q } = await supabaseAdmin
      .from("questions")
      .select(
        "id, title, slug, category, difficulty, description, constraints, starter_code, points, language_id, time_limit_ms, memory_limit_mb, sql_setup, sample_table, is_archived, editorial, editorial_video_id",
      )
      .eq("id", data.questionId)
      .maybeSingle();
    if (!q) return null;

    const [{ data: tests }, { data: links }, { count }, { data: hints }] = await Promise.all([
      supabaseAdmin
        .from("test_cases")
        .select("id, input, expected_output, is_sample")
        .eq("question_id", q.id)
        .order("is_sample", { ascending: false }),
      supabaseAdmin.from("question_topics").select("topic_id").eq("question_id", q.id),
      supabaseAdmin
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("question_id", q.id),
      supabaseAdmin
        .from("question_hints")
        .select("id, hint_text, points_penalty")
        .eq("question_id", q.id)
        .order("order_index"),
    ]);

    return {
      ...q,
      submissions: count ?? 0,
      testCases: (tests ?? []).map((t) => ({
        id: t.id,
        input: t.input ?? "",
        expected_output: t.expected_output ?? "",
        is_sample: t.is_sample,
      })),
      topicIds: (links ?? []).map((l) => l.topic_id),
      hints: (hints ?? []).map((h) => ({
        id: h.id,
        hint_text: h.hint_text,
        points_penalty: h.points_penalty,
      })),
    };
  });

type SavePayload = {
  id?: string | null;
  title: string;
  slug: string;
  category: "practice" | "cp";
  difficulty: "easy" | "medium" | "hard";
  description: string;
  constraints?: string | null;
  starter_code?: string | null;
  points: number;
  language_id?: string | null;
  time_limit_ms?: number;
  memory_limit_mb?: number;
  sql_setup?: string | null;
  is_archived?: boolean;
  testCases: AdminTestCase[];
  topicIds: string[];
  editorial?: string | null;
  editorial_video_id?: string | null;
  hints?: AdminHint[];
};

export const saveQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SavePayload) => {
    const title = String(input.title ?? "")
      .trim()
      .slice(0, 200);
    if (!title) throw new Error("Title is required");
    const slug =
      String(input.slug ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 120) || title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: input.id ? String(input.id) : null,
      title,
      slug,
      category: input.category === "cp" ? ("cp" as const) : ("practice" as const),
      difficulty: (["easy", "medium", "hard"].includes(input.difficulty)
        ? input.difficulty
        : "easy") as "easy" | "medium" | "hard",
      description: String(input.description ?? "").slice(0, 20000),
      constraints: input.constraints ? String(input.constraints).slice(0, 5000) : null,
      starter_code: input.starter_code ? String(input.starter_code).slice(0, 20000) : null,
      points: Math.max(0, Math.min(1000, Number(input.points ?? 50))),
      language_id: input.language_id ? String(input.language_id) : null,
      time_limit_ms: Math.max(200, Math.min(20000, Number(input.time_limit_ms ?? 2000))),
      memory_limit_mb: Math.max(16, Math.min(2048, Number(input.memory_limit_mb ?? 256))),
      sql_setup: input.sql_setup ? String(input.sql_setup).slice(0, 20000) : null,
      is_archived: Boolean(input.is_archived),
      testCases: (input.testCases ?? []).slice(0, 60).map((t) => ({
        input: String(t.input ?? "").slice(0, 20000),
        expected_output: String(t.expected_output ?? "").slice(0, 20000),
        is_sample: Boolean(t.is_sample),
      })),
      topicIds: (input.topicIds ?? []).map(String).slice(0, 10),
      editorial: input.editorial ? String(input.editorial).slice(0, 20000) : null,
      editorial_video_id: input.editorial_video_id
        ? String(input.editorial_video_id).slice(0, 60)
        : null,
      hints: (input.hints ?? []).slice(0, 10).map((h) => ({
        hint_text: String(h.hint_text ?? "").slice(0, 2000),
        points_penalty: Math.max(0, Math.min(1000, Math.round(Number(h.points_penalty) || 0))),
      })),
    };
  })
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    await assertStaff(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      title: data.title,
      slug: data.slug,
      category: data.category,
      difficulty: data.difficulty,
      description: data.description,
      constraints: data.constraints,
      starter_code: data.starter_code,
      points: data.points,
      language_id: data.language_id,
      time_limit_ms: data.time_limit_ms,
      memory_limit_mb: data.memory_limit_mb,
      sql_setup: data.sql_setup,
      is_archived: data.is_archived,
      editorial: data.editorial,
      editorial_video_id: data.editorial_video_id,
    };

    let questionId = data.id;
    if (questionId) {
      const { error } = await supabaseAdmin.from("questions").update(payload).eq("id", questionId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("questions")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      questionId = created.id;
    }

    // Test cases and topics are fully replaced on every save.
    await supabaseAdmin.from("test_cases").delete().eq("question_id", questionId);
    if (data.testCases.length) {
      const { error } = await supabaseAdmin.from("test_cases").insert(
        data.testCases.map((t) => ({
          question_id: questionId,
          input: t.input,
          expected_output: t.expected_output,
          is_sample: t.is_sample,
          is_hidden: !t.is_sample,
        })),
      );
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("question_topics").delete().eq("question_id", questionId);
    if (data.topicIds.length) {
      const { error } = await supabaseAdmin
        .from("question_topics")
        .insert(data.topicIds.map((topic_id) => ({ question_id: questionId!, topic_id })));
      if (error) throw new Error(error.message);
    }

    // Hints are fully replaced on every save, same as test cases and topics.
    await supabaseAdmin.from("question_hints").delete().eq("question_id", questionId);
    if (data.hints.length) {
      const { error } = await supabaseAdmin.from("question_hints").insert(
        data.hints.map((h, order_index) => ({
          question_id: questionId!,
          hint_text: h.hint_text,
          points_penalty: h.points_penalty,
          order_index,
        })),
      );
      if (error) throw new Error(error.message);
    }

    return { id: questionId! };
  });

export const setQuestionArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { questionId: string; archived: boolean }) => ({
    questionId: String(input.questionId),
    archived: Boolean(input.archived),
  }))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("questions")
      .update({ is_archived: data.archived })
      .eq("id", data.questionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Hard delete is only permitted when the question has zero submissions. */
export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { questionId: string }) => ({ questionId: String(input.questionId) }))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("question_id", data.questionId);
    if ((count ?? 0) > 0) {
      throw new Error(
        `This question has ${count} submission(s). Archive it instead so student point history stays intact.`,
      );
    }
    await supabaseAdmin.from("question_topics").delete().eq("question_id", data.questionId);
    await supabaseAdmin.from("test_cases").delete().eq("question_id", data.questionId);
    const { error } = await supabaseAdmin.from("questions").delete().eq("id", data.questionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const previewRunQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      languageSlug: string;
      code: string;
      time_limit_ms?: number;
      memory_limit_mb?: number;
      sql_setup?: string | null;
      testCases: { input: string; expected_output: string }[];
    }) => ({
      languageSlug: String(input.languageSlug),
      code: String(input.code ?? "").slice(0, 60000),
      time_limit_ms: Math.max(200, Math.min(20000, Number(input.time_limit_ms ?? 2000))),
      memory_limit_mb: Math.max(16, Math.min(2048, Number(input.memory_limit_mb ?? 256))),
      sql_setup: input.sql_setup ? String(input.sql_setup).slice(0, 20000) : null,
      testCases: (input.testCases ?? []).slice(0, 20).map((t) => ({
        input: String(t.input ?? ""),
        expected_output: String(t.expected_output ?? ""),
      })),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { runAdHoc } = await import("@/lib/judge.server");
    return runAdHoc({
      languageSlug: data.languageSlug,
      code: data.code,
      timeLimitMs: data.time_limit_ms,
      memoryLimitMb: data.memory_limit_mb,
      sqlSetup: data.sql_setup,
      tests: data.testCases,
    });
  });
