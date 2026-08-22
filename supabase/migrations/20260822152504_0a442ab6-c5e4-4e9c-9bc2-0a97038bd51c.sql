-- Partial-credit visibility (display only — points stay binary, awarded only
-- on a fully-passing first solve) plus a simple CP rating.
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS test_cases_passed integer NOT NULL DEFAULT 0;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS test_cases_total integer NOT NULL DEFAULT 0;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS score numeric(5,2);

-- Simple ELO-style rating. Only ever updated on a first accepted CP solve (a
-- "win" against the problem's reference rating), so it is monotonically
-- non-decreasing — a progress metric, not a full win/loss ladder. No live
-- contests are involved.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cp_rating integer NOT NULL DEFAULT 1200;

CREATE TABLE public.rating_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  old_rating integer NOT NULL,
  new_rating integer NOT NULL,
  delta integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rating_history_user_idx ON public.rating_history (user_id, created_at DESC);
GRANT SELECT ON public.rating_history TO authenticated;
GRANT ALL ON public.rating_history TO service_role;
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own rating history" ON public.rating_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.apply_cp_rating_update(_user_id uuid, _question_id uuid, _submission_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur_rating int;
  diff text;
  opp_rating int;
  expected numeric;
  k int := 32;
  new_rating int;
BEGIN
  SELECT COALESCE(cp_rating, 1200) INTO cur_rating FROM public.profiles WHERE id = _user_id;
  IF cur_rating IS NULL THEN cur_rating := 1200; END IF;

  SELECT difficulty INTO diff FROM public.questions WHERE id = _question_id;
  opp_rating := CASE diff
    WHEN 'easy' THEN 1000
    WHEN 'medium' THEN 1400
    WHEN 'hard' THEN 1800
    ELSE 1200
  END;

  expected := 1.0 / (1.0 + POWER(10, (opp_rating - cur_rating) / 400.0));
  new_rating := GREATEST(cur_rating + ROUND(k * (1 - expected))::int, 0);

  UPDATE public.profiles SET cp_rating = new_rating WHERE id = _user_id;
  INSERT INTO public.rating_history (user_id, question_id, submission_id, old_rating, new_rating, delta)
  VALUES (_user_id, _question_id, _submission_id, cur_rating, new_rating, new_rating - cur_rating);

  RETURN new_rating;
END; $$;
REVOKE ALL ON FUNCTION public.apply_cp_rating_update(uuid, uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_cp_rating_update(uuid, uuid, uuid) TO service_role;
