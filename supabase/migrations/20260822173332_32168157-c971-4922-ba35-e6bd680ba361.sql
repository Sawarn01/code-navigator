-- Course prerequisites + drip scheduling, and lesson watch-time/resume
-- tracking. Both extend course_lessons/lesson_progress, done together.

CREATE TABLE public.course_prerequisites (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  prerequisite_course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, prerequisite_course_id),
  CHECK (course_id <> prerequisite_course_id)
);
GRANT SELECT ON public.course_prerequisites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_prerequisites TO authenticated;
GRANT ALL ON public.course_prerequisites TO service_role;
ALTER TABLE public.course_prerequisites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "course prerequisites public read" ON public.course_prerequisites FOR SELECT USING (true);
CREATE POLICY "staff manage course prerequisites" ON public.course_prerequisites FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Anchor date for drip scheduling, independent of lesson completion. A view
-- of a course auto-enrolls the viewer (no payment/approval gate exists).
CREATE TABLE public.course_enrollments (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);
GRANT SELECT, INSERT ON public.course_enrollments TO authenticated;
GRANT ALL ON public.course_enrollments TO service_role;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own enrollments" ON public.course_enrollments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "users create own enrollments" ON public.course_enrollments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Both nullable -> a lesson with neither set stays always-unlocked (current
-- behavior preserved).
ALTER TABLE public.course_lessons ADD COLUMN IF NOT EXISTS drip_after_days integer;
ALTER TABLE public.course_lessons ADD COLUMN IF NOT EXISTS release_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_course_unlocked(_user_id uuid, _course_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prereq record;
  total int;
  done int;
BEGIN
  FOR prereq IN SELECT prerequisite_course_id FROM public.course_prerequisites WHERE course_id = _course_id LOOP
    SELECT COUNT(*) INTO total FROM public.course_lessons cl
      JOIN public.course_sections cs ON cs.id = cl.section_id
      WHERE cs.course_id = prereq.prerequisite_course_id;
    IF total = 0 THEN CONTINUE; END IF;

    SELECT COUNT(*) INTO done FROM public.lesson_progress lp
      JOIN public.course_lessons cl ON cl.id = lp.lesson_id
      JOIN public.course_sections cs ON cs.id = cl.section_id
      WHERE cs.course_id = prereq.prerequisite_course_id
        AND lp.user_id = _user_id AND lp.completed = true;

    IF done < total THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.is_course_unlocked(uuid, uuid) TO authenticated, anon;

-- Lesson watch-time/resume tracking. Rows can now exist for in-progress
-- (not-yet-completed) lessons, so "row exists" no longer means "completed" —
-- every existing row today only ever got created on completion, so backfill
-- them before the default flips new rows to false.
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS watch_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS last_position_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
UPDATE public.lesson_progress SET completed = true WHERE completed = false;

GRANT UPDATE ON public.lesson_progress TO authenticated;
CREATE POLICY "users update own lesson progress" ON public.lesson_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- issue_certificate_if_complete counted any lesson_progress row as "done" —
-- now that partial-progress rows can exist pre-completion, it must filter on
-- the new completed flag or certificates could be issued early.
CREATE OR REPLACE FUNCTION public.issue_certificate_if_complete(_user_id uuid, _course_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_lessons integer;
  done_lessons integer;
  pending_quizzes integer;
  code text;
BEGIN
  SELECT count(*) INTO total_lessons
  FROM course_lessons cl JOIN course_sections cs ON cs.id = cl.section_id
  WHERE cs.course_id = _course_id;

  IF total_lessons = 0 THEN RETURN NULL; END IF;

  SELECT count(*) INTO done_lessons
  FROM lesson_progress lp
  JOIN course_lessons cl ON cl.id = lp.lesson_id
  JOIN course_sections cs ON cs.id = cl.section_id
  WHERE cs.course_id = _course_id AND lp.user_id = _user_id AND lp.completed = true;

  IF done_lessons < total_lessons THEN RETURN NULL; END IF;

  SELECT count(*) INTO pending_quizzes
  FROM course_quizzes q
  JOIN course_lessons cl ON cl.id = q.lesson_id
  JOIN course_sections cs ON cs.id = cl.section_id
  WHERE cs.course_id = _course_id
    AND NOT EXISTS (
      SELECT 1 FROM quiz_attempts qa
      WHERE qa.quiz_id = q.id AND qa.user_id = _user_id AND qa.passed
    );

  IF pending_quizzes > 0 THEN RETURN NULL; END IF;

  SELECT certificate_code INTO code FROM certificates
  WHERE user_id = _user_id AND course_id = _course_id;
  IF code IS NOT NULL THEN RETURN code; END IF;

  code := 'SPC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  INSERT INTO certificates (user_id, course_id, certificate_code)
  VALUES (_user_id, _course_id, code)
  ON CONFLICT (user_id, course_id) DO NOTHING;

  SELECT certificate_code INTO code FROM certificates
  WHERE user_id = _user_id AND course_id = _course_id;
  RETURN code;
END;
$$;
REVOKE ALL ON FUNCTION public.issue_certificate_if_complete(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_certificate_if_complete(uuid, uuid) TO service_role;
