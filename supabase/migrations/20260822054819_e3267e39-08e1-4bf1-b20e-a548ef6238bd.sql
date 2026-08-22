-- LESSON RESOURCES
CREATE TABLE public.lesson_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_url text NOT NULL,
  type text NOT NULL DEFAULT 'link',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lesson_resources_lesson_idx ON public.lesson_resources(lesson_id);
GRANT SELECT ON public.lesson_resources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_resources TO authenticated;
GRANT ALL ON public.lesson_resources TO service_role;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_resources_public_read" ON public.lesson_resources FOR SELECT USING (true);
CREATE POLICY "lesson_resources_staff_write" ON public.lesson_resources FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER lesson_resources_updated_at BEFORE UPDATE ON public.lesson_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LESSON COMMENTS
CREATE TABLE public.lesson_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  upvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lesson_comments_lesson_idx ON public.lesson_comments(lesson_id, created_at DESC);
GRANT SELECT ON public.lesson_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_comments TO authenticated;
GRANT ALL ON public.lesson_comments TO service_role;
ALTER TABLE public.lesson_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_comments_public_read" ON public.lesson_comments FOR SELECT USING (true);
CREATE POLICY "lesson_comments_insert_own" ON public.lesson_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lesson_comments_update_own" ON public.lesson_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lesson_comments_delete_own_or_staff" ON public.lesson_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE TRIGGER lesson_comments_updated_at BEFORE UPDATE ON public.lesson_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LESSON COMMENT VOTES (one per user per comment)
CREATE TABLE public.lesson_comment_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.lesson_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.lesson_comment_votes TO authenticated;
GRANT ALL ON public.lesson_comment_votes TO service_role;
ALTER TABLE public.lesson_comment_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_comment_votes_read" ON public.lesson_comment_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "lesson_comment_votes_insert_own" ON public.lesson_comment_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lesson_comment_votes_delete_own" ON public.lesson_comment_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_lesson_comment_votes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_comment uuid := COALESCE(NEW.comment_id, OLD.comment_id);
BEGIN
  UPDATE public.lesson_comments c
    SET upvotes = (SELECT COUNT(*) FROM public.lesson_comment_votes v WHERE v.comment_id = c.id)
    WHERE c.id = v_comment;
  RETURN NULL;
END; $$;
CREATE TRIGGER lesson_comment_votes_sync AFTER INSERT OR DELETE ON public.lesson_comment_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_lesson_comment_votes();

-- COURSE REVIEWS
CREATE TABLE public.course_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);
CREATE INDEX course_reviews_course_idx ON public.course_reviews(course_id, created_at DESC);
GRANT SELECT ON public.course_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_reviews TO authenticated;
GRANT ALL ON public.course_reviews TO service_role;
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "course_reviews_public_read" ON public.course_reviews FOR SELECT USING (true);
CREATE POLICY "course_reviews_insert_own" ON public.course_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "course_reviews_update_own" ON public.course_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "course_reviews_delete_own_or_staff" ON public.course_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE TRIGGER course_reviews_updated_at BEFORE UPDATE ON public.course_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();