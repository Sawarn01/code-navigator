-- Daily challenge: one featured practice question per UTC day, plus its own
-- completion streak (separate from the general solving streak on profiles —
-- different reset semantics).
CREATE TABLE public.daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  challenge_date date NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_challenges TO authenticated;
GRANT ALL ON public.daily_challenges TO service_role;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily challenges public read" ON public.daily_challenges FOR SELECT USING (true);
CREATE POLICY "staff manage daily challenges" ON public.daily_challenges FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.daily_challenge_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_challenge_id uuid NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, daily_challenge_id)
);
GRANT SELECT ON public.daily_challenge_completions TO authenticated;
GRANT ALL ON public.daily_challenge_completions TO service_role;
ALTER TABLE public.daily_challenge_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own daily completions" ON public.daily_challenge_completions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_streak_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_streak_last_date date;

CREATE OR REPLACE FUNCTION public.bump_daily_streak()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chal_date date;
  last date;
  cur int;
BEGIN
  SELECT challenge_date INTO chal_date FROM public.daily_challenges WHERE id = NEW.daily_challenge_id;
  SELECT daily_streak_last_date, daily_streak_count INTO last, cur FROM public.profiles WHERE id = NEW.user_id;
  IF last = chal_date THEN RETURN NULL; END IF;
  UPDATE public.profiles
    SET daily_streak_last_date = chal_date,
        daily_streak_count = CASE WHEN last = chal_date - 1 THEN COALESCE(cur, 0) + 1 ELSE 1 END
    WHERE id = NEW.user_id;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.bump_daily_streak() FROM public, anon, authenticated;

CREATE TRIGGER daily_completions_bump_streak AFTER INSERT ON public.daily_challenge_completions
  FOR EACH ROW EXECUTE FUNCTION public.bump_daily_streak();
