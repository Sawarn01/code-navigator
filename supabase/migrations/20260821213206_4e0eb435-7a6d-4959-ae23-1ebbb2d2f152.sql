DO $$
DECLARE t text;
  public_read text[] := ARRAY['badges','course_lessons','course_sections','courses','dictionary_terms','events','forum_posts','forum_replies','forum_votes','languages','profiles','questions','reference_links','test_cases','user_badges'];
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    IF t = ANY(public_read) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    END IF;
  END LOOP;
END $$;