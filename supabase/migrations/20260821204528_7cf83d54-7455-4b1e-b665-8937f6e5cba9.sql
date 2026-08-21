
ALTER TABLE public.languages ADD COLUMN IF NOT EXISTS piston_version text;
ALTER TABLE public.languages ADD COLUMN IF NOT EXISTS piston_language text;

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS time_limit_ms integer NOT NULL DEFAULT 2000;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS memory_limit_mb integer NOT NULL DEFAULT 256;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS sql_setup text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS sample_table text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS tier text;

ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS is_first_solve boolean NOT NULL DEFAULT false;

UPDATE public.languages SET piston_language = lower(slug) WHERE piston_language IS NULL;

CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.points,
  COALESCE(b.badge_count, 0)::int AS badge_count,
  COALESCE(w.week_points, 0)::int AS week_points,
  COALESCE(m.month_points, 0)::int AS month_points,
  COALESCE(s.solved_count, 0)::int AS solved_count,
  RANK() OVER (ORDER BY p.points DESC, p.created_at ASC)::int AS rank
FROM public.profiles p
LEFT JOIN (
  SELECT user_id, COUNT(*) AS badge_count FROM public.user_badges GROUP BY user_id
) b ON b.user_id = p.id
LEFT JOIN (
  SELECT user_id, SUM(points_awarded) AS week_points FROM public.submissions
  WHERE submitted_at >= date_trunc('week', now()) GROUP BY user_id
) w ON w.user_id = p.id
LEFT JOIN (
  SELECT user_id, SUM(points_awarded) AS month_points FROM public.submissions
  WHERE submitted_at >= date_trunc('month', now()) GROUP BY user_id
) m ON m.user_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(DISTINCT question_id) AS solved_count FROM public.submissions
  WHERE status = 'accepted' GROUP BY user_id
) s ON s.user_id = p.id;

GRANT SELECT ON public.leaderboard TO anon, authenticated, service_role;

INSERT INTO public.badges (name, description, criteria_description)
SELECT * FROM (VALUES
  ('First Blood','Made your very first submission on Space.','Submit any solution'),
  ('Century','Earned 100 total points.','Reach 100 points'),
  ('Language Explorer','Solved problems in 3 or more languages.','Solve in 3+ languages'),
  ('CP Rookie','Submitted your first solution in the CP Zone.','Submit a CP problem'),
  ('Streak','Solved problems on 5 different days in a row.','5-day solving streak'),
  ('Top 10','Reached the global top 10 on the leaderboard.','Enter the top 10'),
  ('Polyglot','Solved problems in 5 or more languages.','Solve in 5+ languages'),
  ('Hard Hitter','Solved your first hard problem.','Solve a hard problem')
) AS v(name, description, criteria_description)
WHERE NOT EXISTS (SELECT 1 FROM public.badges b WHERE b.name = v.name);

CREATE OR REPLACE FUNCTION public.award_badge(_user_id uuid, _name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bid uuid;
BEGIN
  SELECT id INTO bid FROM public.badges WHERE name = _name;
  IF bid IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT _user_id, bid
  WHERE NOT EXISTS (SELECT 1 FROM public.user_badges ub WHERE ub.user_id = _user_id AND ub.badge_id = bid);
END; $$;

REVOKE EXECUTE ON FUNCTION public.award_badge(uuid, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.evaluate_badges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lang_count int;
  pts int;
  streak int;
  cat text;
  diff text;
  user_rank int;
BEGIN
  PERFORM public.award_badge(NEW.user_id, 'First Blood');

  SELECT points INTO pts FROM public.profiles WHERE id = NEW.user_id;
  IF COALESCE(pts,0) >= 100 THEN PERFORM public.award_badge(NEW.user_id, 'Century'); END IF;

  SELECT category, difficulty INTO cat, diff FROM public.questions WHERE id = NEW.question_id;
  IF cat = 'cp' THEN PERFORM public.award_badge(NEW.user_id, 'CP Rookie'); END IF;
  IF NEW.status = 'accepted' AND diff = 'hard' THEN PERFORM public.award_badge(NEW.user_id, 'Hard Hitter'); END IF;

  SELECT COUNT(DISTINCT language) INTO lang_count FROM public.submissions
   WHERE user_id = NEW.user_id AND status = 'accepted' AND language IS NOT NULL;
  IF lang_count >= 3 THEN PERFORM public.award_badge(NEW.user_id, 'Language Explorer'); END IF;
  IF lang_count >= 5 THEN PERFORM public.award_badge(NEW.user_id, 'Polyglot'); END IF;

  WITH days AS (
    SELECT DISTINCT (submitted_at AT TIME ZONE 'UTC')::date AS d
    FROM public.submissions WHERE user_id = NEW.user_id AND status = 'accepted'
  ), grouped AS (
    SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp FROM days
  )
  SELECT COALESCE(MAX(c),0) INTO streak FROM (SELECT COUNT(*) AS c FROM grouped GROUP BY grp) x;
  IF streak >= 5 THEN PERFORM public.award_badge(NEW.user_id, 'Streak'); END IF;

  SELECT rank INTO user_rank FROM public.leaderboard WHERE user_id = NEW.user_id;
  IF COALESCE(user_rank, 999) <= 10 THEN PERFORM public.award_badge(NEW.user_id, 'Top 10'); END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS submissions_evaluate_badges ON public.submissions;
CREATE TRIGGER submissions_evaluate_badges
AFTER INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.evaluate_badges();
