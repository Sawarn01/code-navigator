-- Event capacity + waitlist + attendance + post-event feedback.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity integer;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'waitlisted', 'attended', 'no_show')),
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Attendance is a staff-only action (manual check-in), never self-reported.
GRANT UPDATE ON public.event_registrations TO authenticated;
CREATE POLICY "staff update registrations" ON public.event_registrations FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.event_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.event_feedback TO authenticated;
GRANT ALL ON public.event_feedback TO service_role;
ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own event feedback" ON public.event_feedback FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff read event feedback" ON public.event_feedback FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Atomic register-or-waitlist, replacing the plain insert in toggleRegistration
-- (which had a capacity-check race). Locks the event row so concurrent
-- registrations for the same event serialize.
CREATE OR REPLACE FUNCTION public.register_for_event(_event_id uuid, _user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cap int;
  taken int;
  result_status text;
BEGIN
  PERFORM 1 FROM public.events WHERE id = _event_id FOR UPDATE;
  SELECT capacity INTO cap FROM public.events WHERE id = _event_id;

  IF cap IS NOT NULL THEN
    SELECT COUNT(*) INTO taken FROM public.event_registrations
      WHERE event_id = _event_id AND status IN ('registered', 'attended');
    result_status := CASE WHEN taken >= cap THEN 'waitlisted' ELSE 'registered' END;
  ELSE
    result_status := 'registered';
  END IF;

  INSERT INTO public.event_registrations (event_id, user_id, status)
  VALUES (_event_id, _user_id, result_status)
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status
  RETURNING status INTO result_status;

  RETURN result_status;
END; $$;
REVOKE ALL ON FUNCTION public.register_for_event(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_for_event(uuid, uuid) TO service_role;

-- Called after a cancellation to pull the longest-waiting waitlisted student
-- into the freed slot.
CREATE OR REPLACE FUNCTION public.promote_next_waitlisted(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cap int;
  taken int;
  next_id uuid;
BEGIN
  PERFORM 1 FROM public.events WHERE id = _event_id FOR UPDATE;
  SELECT capacity INTO cap FROM public.events WHERE id = _event_id;
  IF cap IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO taken FROM public.event_registrations
    WHERE event_id = _event_id AND status IN ('registered', 'attended');
  IF taken >= cap THEN RETURN; END IF;

  SELECT id INTO next_id FROM public.event_registrations
    WHERE event_id = _event_id AND status = 'waitlisted'
    ORDER BY registered_at ASC LIMIT 1;
  IF next_id IS NOT NULL THEN
    UPDATE public.event_registrations SET status = 'registered' WHERE id = next_id;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.promote_next_waitlisted(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_next_waitlisted(uuid) TO service_role;
