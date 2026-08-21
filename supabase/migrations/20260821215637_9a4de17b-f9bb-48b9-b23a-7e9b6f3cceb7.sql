CREATE TRIGGER profiles_points_refresh_leaderboard
AFTER UPDATE OF points ON public.profiles
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_leaderboard();

SELECT public.refresh_leaderboard();