
REVOKE SELECT ON public.leaderboard FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.seed_question(
  _title text, _slug text, _lang_slug text, _difficulty text, _category text,
  _description text, _constraints text, _starter text, _points int, _tests jsonb,
  _time_limit_ms int DEFAULT 2000, _memory_limit_mb int DEFAULT 256,
  _tier text DEFAULT NULL, _sql_setup text DEFAULT NULL, _sample_table text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE qid uuid; lid uuid; t jsonb;
BEGIN
  SELECT id INTO lid FROM public.languages WHERE slug = _lang_slug;
  SELECT id INTO qid FROM public.questions WHERE slug = _slug;
  IF qid IS NOT NULL THEN RETURN qid; END IF;
  INSERT INTO public.questions (title, slug, language_id, difficulty, category, description, constraints,
    starter_code, points, time_limit_ms, memory_limit_mb, tier, sql_setup, sample_table)
  VALUES (_title, _slug, lid, _difficulty, _category, _description, _constraints,
    _starter, _points, _time_limit_ms, _memory_limit_mb, _tier, _sql_setup, _sample_table)
  RETURNING id INTO qid;
  FOR t IN SELECT * FROM jsonb_array_elements(_tests) LOOP
    INSERT INTO public.test_cases (question_id, input, expected_output, is_sample, is_hidden)
    VALUES (qid, t->>'in', t->>'out', COALESCE((t->>'sample')::boolean, false), NOT COALESCE((t->>'sample')::boolean, false));
  END LOOP;
  RETURN qid;
END; $$;
REVOKE EXECUTE ON FUNCTION public.seed_question(text,text,text,text,text,text,text,text,int,jsonb,int,int,text,text,text) FROM public, anon, authenticated;
