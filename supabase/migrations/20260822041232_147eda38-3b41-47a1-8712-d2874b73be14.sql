-- helpers
CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
$$;

-- STUDY GROUPS
CREATE TABLE public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT true,
  invite_code text NOT NULL UNIQUE DEFAULT public.gen_invite_code(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.study_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_groups TO authenticated;
GRANT ALL ON public.study_groups TO service_role;
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "study groups public read" ON public.study_groups FOR SELECT USING (true);
CREATE POLICY "users create groups" ON public.study_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "owner or admin update group" ON public.study_groups FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin delete group" ON public.study_groups FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER study_groups_updated_at BEFORE UPDATE ON public.study_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.study_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_group_members TO authenticated;
GRANT ALL ON public.study_group_members TO service_role;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.study_group_members m WHERE m.group_id = _group_id AND m.user_id = _user_id)
$$;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated, anon;

CREATE POLICY "members read membership" ON public.study_group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users join groups" ON public.study_group_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leave or owner removes" ON public.study_group_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = group_id AND g.created_by = auth.uid()));

CREATE TABLE public.study_group_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_group_posts TO authenticated;
GRANT ALL ON public.study_group_posts TO service_role;
ALTER TABLE public.study_group_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read group posts" ON public.study_group_posts FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "members write group posts" ON public.study_group_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "authors delete group posts" ON public.study_group_posts FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE TABLE public.study_group_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.study_group_posts(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_group_replies TO authenticated;
GRANT ALL ON public.study_group_replies TO service_role;
ALTER TABLE public.study_group_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read group replies" ON public.study_group_replies FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "members write group replies" ON public.study_group_replies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "authors delete group replies" ON public.study_group_replies FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- MENTORSHIP
CREATE TABLE public.mentor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_assignments TO authenticated;
GRANT ALL ON public.mentor_assignments TO service_role;
ALTER TABLE public.mentor_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentor or admin reads assignments" ON public.mentor_assignments FOR SELECT TO authenticated
  USING (auth.uid() = mentor_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage assignments" ON public.mentor_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.mentor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_notes TO authenticated;
GRANT ALL ON public.mentor_notes TO service_role;
ALTER TABLE public.mentor_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "author or admin reads notes" ON public.mentor_notes FOR SELECT TO authenticated
  USING (auth.uid() = mentor_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mentors write own notes" ON public.mentor_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = mentor_id AND public.is_staff(auth.uid()));
CREATE POLICY "mentors delete own notes" ON public.mentor_notes FOR DELETE TO authenticated
  USING (auth.uid() = mentor_id OR public.has_role(auth.uid(), 'admin'));

-- HACKATHON TEAMS
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_size integer NOT NULL DEFAULT 4,
  invite_code text NOT NULL UNIQUE DEFAULT public.gen_invite_code(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams public read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "users create teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "creator updates team" ON public.teams FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_staff(auth.uid())) WITH CHECK (auth.uid() = created_by OR public.is_staff(auth.uid()));
CREATE POLICY "creator deletes team" ON public.teams FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_staff(auth.uid()));

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
GRANT SELECT ON public.team_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members public read" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "users join teams" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leave or captain removes" ON public.team_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id
    OR public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.created_by = auth.uid()));

CREATE OR REPLACE FUNCTION public.enforce_team_size()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cap int; current_count int;
BEGIN
  SELECT max_size INTO cap FROM public.teams WHERE id = NEW.team_id;
  SELECT COUNT(*) INTO current_count FROM public.team_members WHERE team_id = NEW.team_id;
  IF current_count >= COALESCE(cap, 4) THEN
    RAISE EXCEPTION 'This team is already full';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER team_members_size_cap BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_size();

ALTER TABLE public.event_registrations ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
CREATE POLICY "users update own registrations" ON public.event_registrations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- SEED DATA
DO $seed$
DECLARE owner_id uuid; g uuid; p uuid; ev uuid; t1 uuid; t2 uuid;
BEGIN
  SELECT id INTO owner_id FROM public.profiles ORDER BY created_at LIMIT 1;
  IF owner_id IS NULL THEN RETURN; END IF;
  SELECT id INTO ev FROM public.events WHERE type = 'mini-hackathon' ORDER BY start_time LIMIT 1;

  INSERT INTO public.study_groups (name, description, created_by, is_public) VALUES
    ('ICPC Prep Squad', 'Weekly graph and DP drills for the regional qualifiers. We meet every Tuesday.', owner_id, true),
    ('Interview Grind: Arrays & Strings', 'Two problems a day, discussion in the evening. Beginner friendly.', owner_id, true),
    ('Python Data Structures Club', 'Working through heaps, tries and union-find in pure Python.', owner_id, true),
    ('SQL Query Masters', 'Window functions, CTEs and query optimisation practice.', owner_id, true),
    ('Systems & C++ Deep Dive', 'Memory, pointers and STL internals. Private group for the C++ track.', owner_id, false);

  FOR g IN SELECT id FROM public.study_groups LOOP
    INSERT INTO public.study_group_members (group_id, user_id, role) VALUES (g, owner_id, 'owner')
      ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT id INTO g FROM public.study_groups WHERE name = 'ICPC Prep Squad';
  INSERT INTO public.study_group_posts (group_id, user_id, body) VALUES
    (g, owner_id, 'Kicking off week 1: shortest paths. Solve **Dijkstra with potentials** and post your runtime here.')
    RETURNING id INTO p;
  INSERT INTO public.study_group_replies (post_id, group_id, user_id, body) VALUES
    (p, g, owner_id, 'Reference implementation posted in the Reference hub — check the CP section.');

  SELECT id INTO g FROM public.study_groups WHERE name = 'Interview Grind: Arrays & Strings';
  INSERT INTO public.study_group_posts (group_id, user_id, body) VALUES
    (g, owner_id, 'Today: Two Sum and Longest Substring Without Repeating Characters. Drop your approach before looking at solutions.');

  IF ev IS NOT NULL THEN
    INSERT INTO public.teams (event_id, name, created_by, max_size) VALUES (ev, 'Segment Fault', owner_id, 4) RETURNING id INTO t1;
    INSERT INTO public.teams (event_id, name, created_by, max_size) VALUES (ev, 'Null Pointers', owner_id, 4) RETURNING id INTO t2;
    INSERT INTO public.team_members (team_id, user_id) VALUES (t1, owner_id);
    INSERT INTO public.event_registrations (event_id, user_id, team_id) VALUES (ev, owner_id, t1)
      ON CONFLICT DO NOTHING;
  END IF;
END $seed$;
