-- Official college clubs directory (staff-managed), distinct from the
-- student-created study_groups: clubs are created/edited by staff, and
-- students self-service join/leave, mirroring the teams/team_members
-- read-model and the study_groups owner-or-admin write model.
CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  meeting_info text,
  contact_email text,
  logo_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clubs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clubs public read" ON public.clubs FOR SELECT USING (true);
CREATE POLICY "staff create clubs" ON public.clubs FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update clubs" ON public.clubs FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff delete clubs" ON public.clubs FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);
GRANT SELECT ON public.club_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members TO authenticated;
GRANT ALL ON public.club_members TO service_role;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club members public read" ON public.club_members FOR SELECT USING (true);
CREATE POLICY "users join clubs" ON public.club_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leave or staff removes" ON public.club_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
