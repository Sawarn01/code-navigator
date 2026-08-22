-- Study group challenges (group-vs-group leaderboard reuses existing
-- study_group_members/profiles.points data, no new table needed for that).
CREATE TABLE public.group_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT, INSERT, DELETE ON public.group_challenges TO authenticated;
GRANT ALL ON public.group_challenges TO service_role;
ALTER TABLE public.group_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read group challenges" ON public.group_challenges FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner creates group challenges" ON public.group_challenges FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.study_group_members m
      WHERE m.group_id = group_challenges.group_id AND m.user_id = auth.uid() AND m.role = 'owner'
    )
  );
CREATE POLICY "owner deletes group challenges" ON public.group_challenges FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_group_members m
      WHERE m.group_id = group_challenges.group_id AND m.user_id = auth.uid() AND m.role = 'owner'
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Unified activity feed. Insert-only via triggers — no direct client writes,
-- same privilege model as the notifications table.
CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('submission', 'badge', 'certificate', 'event_registration')),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_events_user_created_idx ON public.activity_events (user_id, created_at DESC);
GRANT SELECT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own activity" ON public.activity_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Only first-solve accepted submissions are logged — keeps the feed
-- meaningful instead of one entry per resubmission.
CREATE OR REPLACE FUNCTION public.log_submission_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND NEW.is_first_solve THEN
    INSERT INTO public.activity_events (user_id, type, payload)
    VALUES (
      NEW.user_id, 'submission',
      jsonb_build_object('question_id', NEW.question_id, 'points_awarded', NEW.points_awarded)
    );
  END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.log_submission_activity() FROM public, anon, authenticated;
CREATE TRIGGER submissions_log_activity AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.log_submission_activity();

CREATE OR REPLACE FUNCTION public.log_badge_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_events (user_id, type, payload)
  VALUES (NEW.user_id, 'badge', jsonb_build_object('badge_id', NEW.badge_id));
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.log_badge_activity() FROM public, anon, authenticated;
CREATE TRIGGER user_badges_log_activity AFTER INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.log_badge_activity();

CREATE OR REPLACE FUNCTION public.log_certificate_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_events (user_id, type, payload)
  VALUES (
    NEW.user_id, 'certificate',
    jsonb_build_object('course_id', NEW.course_id, 'certificate_code', NEW.certificate_code)
  );
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.log_certificate_activity() FROM public, anon, authenticated;
CREATE TRIGGER certificates_log_activity AFTER INSERT ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.log_certificate_activity();

CREATE OR REPLACE FUNCTION public.log_event_registration_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'registered' THEN
    INSERT INTO public.activity_events (user_id, type, payload)
    VALUES (NEW.user_id, 'event_registration', jsonb_build_object('event_id', NEW.event_id));
  END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.log_event_registration_activity() FROM public, anon, authenticated;
CREATE TRIGGER event_registrations_log_activity AFTER INSERT ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.log_event_registration_activity();
