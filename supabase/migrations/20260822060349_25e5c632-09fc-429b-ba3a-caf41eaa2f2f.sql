CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text NOT NULL DEFAULT 'Sparkles',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.topics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Topics are public" ON public.topics FOR SELECT USING (true);
CREATE POLICY "Staff manage topics" ON public.topics FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER topics_updated_at BEFORE UPDATE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.question_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, topic_id)
);
CREATE INDEX question_topics_topic_idx ON public.question_topics(topic_id);
CREATE INDEX question_topics_question_idx ON public.question_topics(question_id);
GRANT SELECT ON public.question_topics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_topics TO authenticated;
GRANT ALL ON public.question_topics TO service_role;
ALTER TABLE public.question_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Question topics are public" ON public.question_topics FOR SELECT USING (true);
CREATE POLICY "Staff manage question topics" ON public.question_topics FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE VIEW public.user_topic_mastery WITH (security_invoker = true) AS
SELECT
  s.user_id,
  t.id AS topic_id,
  t.name AS topic_name,
  t.slug AS topic_slug,
  COUNT(DISTINCT s.question_id) AS attempted,
  COUNT(DISTINCT s.question_id) FILTER (WHERE s.status = 'accepted') AS solved,
  COUNT(*) AS submissions,
  COUNT(*) FILTER (WHERE s.status = 'accepted') AS accepted_submissions,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE s.status = 'accepted') / GREATEST(COUNT(*), 1)
  )::int AS pass_rate
FROM public.submissions s
JOIN public.question_topics qt ON qt.question_id = s.question_id
JOIN public.topics t ON t.id = qt.topic_id
GROUP BY s.user_id, t.id, t.name, t.slug;

GRANT SELECT ON public.user_topic_mastery TO authenticated;
GRANT ALL ON public.user_topic_mastery TO service_role;