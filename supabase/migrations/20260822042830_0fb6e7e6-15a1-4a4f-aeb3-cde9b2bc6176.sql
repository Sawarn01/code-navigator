-- 1. Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('badge_earned','forum_reply','event_reminder','streak_risk','mentor_note','group_invite')),
  title text NOT NULL,
  body text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 2. Notification preferences
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_earned boolean NOT NULL DEFAULT true,
  forum_reply boolean NOT NULL DEFAULT true,
  event_reminder boolean NOT NULL DEFAULT true,
  streak_risk boolean NOT NULL DEFAULT true,
  mentor_note boolean NOT NULL DEFAULT true,
  group_invite boolean NOT NULL DEFAULT true,
  email_digest boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own prefs" ON public.notification_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own prefs" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own prefs" ON public.notification_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notification_preferences (user_id)
  SELECT id FROM public.profiles ON CONFLICT DO NOTHING;

-- 3. Streak columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_date date;

-- 4. Notification helper (respects preferences)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid, _type text, _title text, _body text DEFAULT NULL, _link text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowed boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notification_preferences (user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;
  EXECUTE format('SELECT %I FROM public.notification_preferences WHERE user_id = $1', _type)
    INTO allowed USING _user_id;
  IF COALESCE(allowed, true) = false THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link);
END; $$;

-- default prefs row for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  _domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  if not exists (select 1 from public.allowed_email_domains d where d.domain = _domain) then
    raise exception 'Sign-up restricted to approved institutional email domains';
  end if;

  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  insert into public.notification_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end; $$;

-- 5. Badge earned notification
CREATE OR REPLACE FUNCTION public.notify_badge_earned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bname text;
BEGIN
  SELECT name INTO bname FROM public.badges WHERE id = NEW.badge_id;
  PERFORM public.create_notification(NEW.user_id, 'badge_earned',
    'Badge unlocked: ' || COALESCE(bname, 'New badge'),
    'You just earned a new badge on Space. Keep the momentum going.',
    '/profile/me');
  RETURN NULL;
END; $$;
CREATE TRIGGER user_badges_notify AFTER INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.notify_badge_earned();

-- 6. Forum reply notification
CREATE OR REPLACE FUNCTION public.notify_forum_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE author uuid; ptitle text;
BEGIN
  SELECT user_id, title INTO author, ptitle FROM public.forum_posts WHERE id = NEW.post_id;
  IF author IS NULL OR author = NEW.user_id THEN RETURN NULL; END IF;
  PERFORM public.create_notification(author, 'forum_reply',
    'New reply on "' || left(COALESCE(ptitle,'your thread'), 60) || '"',
    left(NEW.body, 140), '/forum/' || NEW.post_id::text);
  RETURN NULL;
END; $$;
CREATE TRIGGER forum_replies_notify AFTER INSERT ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.notify_forum_reply();

-- 7. Mentor note notification (student is told a note exists, never its content)
CREATE OR REPLACE FUNCTION public.notify_mentor_note()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.student_id, 'mentor_note',
    'Your mentor logged a check-in',
    'Your mentor recorded a private note after reviewing your progress.',
    '/profile/me');
  RETURN NULL;
END; $$;
CREATE TRIGGER mentor_notes_notify AFTER INSERT ON public.mentor_notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentor_note();

-- 8. Streak bump on accepted submission
CREATE OR REPLACE FUNCTION public.bump_streak()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE today date := (now() AT TIME ZONE 'UTC')::date; last date; cur int;
BEGIN
  IF NEW.status IS DISTINCT FROM 'accepted' THEN RETURN NULL; END IF;
  SELECT last_active_date, streak_count INTO last, cur FROM public.profiles WHERE id = NEW.user_id;
  IF last = today THEN RETURN NULL; END IF;
  UPDATE public.profiles
    SET last_active_date = today,
        streak_count = CASE WHEN last = today - 1 THEN COALESCE(cur,0) + 1 ELSE 1 END
    WHERE id = NEW.user_id;
  RETURN NULL;
END; $$;
CREATE TRIGGER submissions_bump_streak AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.bump_streak();

-- 9. Daily streak reset
CREATE OR REPLACE FUNCTION public.reset_broken_streaks()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles
    SET streak_count = 0
    WHERE streak_count > 0
      AND (last_active_date IS NULL
           OR last_active_date < ((now() AT TIME ZONE 'UTC')::date - 1));
$$;

-- 10. Daily streak-risk notifications
CREATE OR REPLACE FUNCTION public.notify_streak_risk()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  FOR r IN
    SELECT id, streak_count FROM public.profiles
    WHERE streak_count > 0 AND COALESCE(last_active_date, today - 10) < today
  LOOP
    IF EXISTS (SELECT 1 FROM public.notifications n
               WHERE n.user_id = r.id AND n.type = 'streak_risk'
                 AND (n.created_at AT TIME ZONE 'UTC')::date = today) THEN
      CONTINUE;
    END IF;
    PERFORM public.create_notification(r.id, 'streak_risk',
      'Your ' || r.streak_count || '-day streak is at risk',
      'Solve one problem today to keep your streak alive.',
      '/practice');
  END LOOP;
END; $$;

-- 11. Schedules
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule('space-reset-streaks', '10 0 * * *', $$SELECT public.reset_broken_streaks();$$);
SELECT cron.schedule('space-streak-risk', '0 17 * * *', $$SELECT public.notify_streak_risk();$$);
SELECT cron.schedule(
  'space-weekly-digest',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://project--6a8a41d5-f3a6-4769-a2e5-bd27fa8d98b6.lovable.app/api/public/hooks/weekly-digest',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtYmhsaWJ4c29kcWNqb2Zxc3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMjk1NDIsImV4cCI6MjEwMjkwNTU0Mn0.H7ju0cJlzsMsO8HInD_jVKNT3KH_kf65MHijd4BH2As"}'::jsonb,
    body := '{"source": "pg_cron"}'::jsonb
  );
  $$
);