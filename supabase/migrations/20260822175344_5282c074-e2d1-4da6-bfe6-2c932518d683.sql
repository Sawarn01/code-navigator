-- Mentor session booking. Kept separate from the existing async mentor_notes
-- flow, but validated against the existing mentor_assignments pairing — a
-- student can only book slots with their own assigned mentor.
CREATE TABLE public.mentor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_booked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX mentor_availability_mentor_idx ON public.mentor_availability (mentor_id, start_time);
GRANT SELECT, INSERT, DELETE ON public.mentor_availability TO authenticated;
GRANT ALL ON public.mentor_availability TO service_role;
ALTER TABLE public.mentor_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentor manages own availability" ON public.mentor_availability FOR ALL TO authenticated
  USING (auth.uid() = mentor_id) WITH CHECK (auth.uid() = mentor_id);
CREATE POLICY "assigned mentees read mentor availability" ON public.mentor_availability FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_assignments ma
      WHERE ma.mentor_id = mentor_availability.mentor_id AND ma.student_id = auth.uid()
    )
  );

-- Bookings are read-only for participants at the table level — all writes go
-- through the two SECURITY DEFINER functions below so the availability slot
-- and booking row always change together.
CREATE TABLE public.mentor_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  availability_id uuid NOT NULL UNIQUE REFERENCES public.mentor_availability(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);
GRANT SELECT ON public.mentor_bookings TO authenticated;
GRANT ALL ON public.mentor_bookings TO service_role;
ALTER TABLE public.mentor_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read own bookings" ON public.mentor_bookings FOR SELECT TO authenticated
  USING (auth.uid() = mentor_id OR auth.uid() = mentee_id);

CREATE OR REPLACE FUNCTION public.book_mentor_slot(_availability_id uuid, _mentee_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  slot record;
  is_assigned boolean;
  booking_id uuid;
BEGIN
  SELECT * INTO slot FROM public.mentor_availability WHERE id = _availability_id FOR UPDATE;
  IF slot IS NULL THEN RAISE EXCEPTION 'Slot not found'; END IF;
  IF slot.is_booked THEN RAISE EXCEPTION 'This slot was just booked by someone else'; END IF;
  IF slot.start_time <= now() THEN RAISE EXCEPTION 'This slot is in the past'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.mentor_assignments
    WHERE mentor_id = slot.mentor_id AND student_id = _mentee_id
  ) INTO is_assigned;
  IF NOT is_assigned THEN RAISE EXCEPTION 'You are not assigned to this mentor'; END IF;

  UPDATE public.mentor_availability SET is_booked = true WHERE id = _availability_id;
  INSERT INTO public.mentor_bookings (availability_id, mentor_id, mentee_id)
  VALUES (_availability_id, slot.mentor_id, _mentee_id)
  RETURNING id INTO booking_id;

  RETURN booking_id;
END; $$;
REVOKE ALL ON FUNCTION public.book_mentor_slot(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_mentor_slot(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_mentor_booking(_booking_id uuid, _actor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b record;
BEGIN
  SELECT * INTO b FROM public.mentor_bookings WHERE id = _booking_id FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF b.mentor_id <> _actor_id AND b.mentee_id <> _actor_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF b.status <> 'confirmed' THEN RETURN; END IF;

  UPDATE public.mentor_bookings SET status = 'cancelled', cancelled_at = now() WHERE id = _booking_id;
  UPDATE public.mentor_availability SET is_booked = false WHERE id = b.availability_id;
END; $$;
REVOKE ALL ON FUNCTION public.cancel_mentor_booking(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_mentor_booking(uuid, uuid) TO service_role;
