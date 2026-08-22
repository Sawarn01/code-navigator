-- Leaderboard privacy opt-out: a student can hide themselves from all
-- leaderboards (global, per-topic, per-group) while keeping their points,
-- badges and streak intact.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS leaderboard_opt_out boolean NOT NULL DEFAULT false;

-- Recreate the leaderboard materialized view with the opt-out filter. The
-- underlying refresh function/triggers reference it by name only, so they
-- need no changes.
DROP MATERIALIZED VIEW IF EXISTS public.leaderboard;

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
LEFT JOIN (SELECT user_id, COUNT(DISTINCT question_id) AS solved_count FROM public.submissions WHERE status = 'accepted' GROUP BY user_id) s ON s.user_id = p.id
WHERE p.leaderboard_opt_out = false;

CREATE UNIQUE INDEX leaderboard_user_id_idx ON public.leaderboard (user_id);
GRANT SELECT ON public.leaderboard TO anon, authenticated, service_role;

SELECT public.refresh_leaderboard();
