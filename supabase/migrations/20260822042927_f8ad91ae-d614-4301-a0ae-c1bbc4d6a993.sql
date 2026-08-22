REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_badge_earned() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_forum_reply() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_mentor_note() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_streak() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_broken_streaks() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_streak_risk() FROM public, anon, authenticated;