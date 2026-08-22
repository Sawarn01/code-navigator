-- Per-question editorial, hints (revealed with a point penalty), and a
-- discussion thread. Discussion reuses forum_posts via a nullable
-- question_id rather than a parallel comment system.
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS editorial text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS editorial_video_id text;

-- Hint text is intentionally NOT public-readable: it must only reach the
-- client through a server function that checks/records the reveal, so the
-- point-penalty mechanic can't be bypassed by querying the table directly.
CREATE TABLE public.question_hints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  hint_text text NOT NULL,
  points_penalty integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX question_hints_question_idx ON public.question_hints (question_id);
GRANT ALL ON public.question_hints TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_hints TO authenticated;
ALTER TABLE public.question_hints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage question hints" ON public.question_hints FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.question_hint_reveals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hint_id uuid NOT NULL REFERENCES public.question_hints(id) ON DELETE CASCADE,
  revealed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hint_id)
);
GRANT SELECT ON public.question_hint_reveals TO authenticated;
GRANT ALL ON public.question_hint_reveals TO service_role;
ALTER TABLE public.question_hint_reveals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own hint reveals" ON public.question_hint_reveals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.forum_posts ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL;
CREATE INDEX forum_posts_question_idx ON public.forum_posts (question_id) WHERE question_id IS NOT NULL;
