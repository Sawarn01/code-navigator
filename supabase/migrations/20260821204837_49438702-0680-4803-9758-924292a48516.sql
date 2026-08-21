
DROP VIEW IF EXISTS public.leaderboard;

CREATE MATERIALIZED VIEW public.leaderboard AS
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
LEFT JOIN (SELECT user_id, COUNT(*) AS badge_count FROM public.user_badges GROUP BY user_id) b ON b.user_id = p.id
LEFT JOIN (SELECT user_id, SUM(points_awarded) AS week_points FROM public.submissions WHERE submitted_at >= date_trunc('week', now()) GROUP BY user_id) w ON w.user_id = p.id
LEFT JOIN (SELECT user_id, SUM(points_awarded) AS month_points FROM public.submissions WHERE submitted_at >= date_trunc('month', now()) GROUP BY user_id) m ON m.user_id = p.id
LEFT JOIN (SELECT user_id, COUNT(DISTINCT question_id) AS solved_count FROM public.submissions WHERE status = 'accepted' GROUP BY user_id) s ON s.user_id = p.id;

CREATE UNIQUE INDEX leaderboard_user_id_idx ON public.leaderboard (user_id);
GRANT SELECT ON public.leaderboard TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard;
EXCEPTION WHEN OTHERS THEN
  REFRESH MATERIALIZED VIEW public.leaderboard;
END; $$;
REVOKE EXECUTE ON FUNCTION public.refresh_leaderboard() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_refresh_leaderboard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.refresh_leaderboard();
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.trg_refresh_leaderboard() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_badges() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS submissions_refresh_leaderboard ON public.submissions;
CREATE TRIGGER submissions_refresh_leaderboard
AFTER INSERT ON public.submissions
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_leaderboard();

DROP TRIGGER IF EXISTS badges_refresh_leaderboard ON public.user_badges;
CREATE TRIGGER badges_refresh_leaderboard
AFTER INSERT ON public.user_badges
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_leaderboard();

CREATE OR REPLACE FUNCTION public.evaluate_badges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lang_count int; pts int; streak int; cat text; diff text; user_rank int;
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
  ), grouped AS (SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp FROM days)
  SELECT COALESCE(MAX(c),0) INTO streak FROM (SELECT COUNT(*) AS c FROM grouped GROUP BY grp) x;
  IF streak >= 5 THEN PERFORM public.award_badge(NEW.user_id, 'Streak'); END IF;
  SELECT rank INTO user_rank FROM public.leaderboard WHERE user_id = NEW.user_id;
  IF COALESCE(user_rank, 999) <= 10 THEN PERFORM public.award_badge(NEW.user_id, 'Top 10'); END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.evaluate_badges() FROM public, anon, authenticated;
