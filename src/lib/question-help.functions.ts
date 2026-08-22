import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuestionHint = {
  id: string;
  orderIndex: number;
  pointsPenalty: number;
  /** null until the user has revealed this hint. */
  text: string | null;
};

export type QuestionHelp = {
  editorial: string | null;
  editorialVideoId: string | null;
  hasSolved: boolean;
  hints: QuestionHint[];
};

/** Hints stay locked (text: null) until revealed; editorial stays hidden until solved. */
export const getQuestionHelp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { questionId: string }) => ({ questionId: String(input.questionId) }))
  .handler(async ({ context, data }): Promise<QuestionHelp> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: question }, { data: solved }, { data: hints }, { data: reveals }] =
      await Promise.all([
        supabaseAdmin
          .from("questions")
          .select("editorial, editorial_video_id")
          .eq("id", data.questionId)
          .maybeSingle(),
        context.supabase
          .from("submissions")
          .select("id")
          .eq("user_id", context.userId)
          .eq("question_id", data.questionId)
          .eq("status", "accepted")
          .limit(1),
        supabaseAdmin
          .from("question_hints")
          .select("id, order_index, points_penalty")
          .eq("question_id", data.questionId)
          .order("order_index"),
        context.supabase
          .from("question_hint_reveals")
          .select("hint_id")
          .eq("user_id", context.userId),
      ]);

    const hasSolved = (solved ?? []).length > 0;
    const revealedIds = new Set((reveals ?? []).map((r) => r.hint_id));
    const revealedHintIds = (hints ?? []).map((h) => h.id).filter((id) => revealedIds.has(id));

    const { data: revealedHints } = revealedHintIds.length
      ? await supabaseAdmin.from("question_hints").select("id, hint_text").in("id", revealedHintIds)
      : { data: [] as { id: string; hint_text: string }[] };
    const textById = new Map((revealedHints ?? []).map((h) => [h.id, h.hint_text]));

    return {
      editorial: hasSolved ? (question?.editorial ?? null) : null,
      editorialVideoId: hasSolved ? (question?.editorial_video_id ?? null) : null,
      hasSolved,
      hints: (hints ?? []).map((h) => ({
        id: h.id,
        orderIndex: h.order_index,
        pointsPenalty: h.points_penalty,
        text: textById.get(h.id) ?? null,
      })),
    };
  });

export const revealHint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { hintId: string }) => ({ hintId: String(input.hintId) }))
  .handler(async ({ context, data }): Promise<{ text: string; pointsPenalty: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: hint } = await supabaseAdmin
      .from("question_hints")
      .select("id, hint_text, points_penalty")
      .eq("id", data.hintId)
      .maybeSingle();
    if (!hint) throw new Error("Hint not found");

    const { error } = await supabaseAdmin
      .from("question_hint_reveals")
      .insert({ user_id: context.userId, hint_id: hint.id });
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);

    return { text: hint.hint_text, pointsPenalty: hint.points_penalty };
  });
