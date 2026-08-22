
-- ============ QUIZZES ============
CREATE TABLE public.course_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  pass_threshold integer NOT NULL DEFAULT 70,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id)
);
GRANT SELECT ON public.course_quizzes TO anon, authenticated;
GRANT ALL ON public.course_quizzes TO service_role;
ALTER TABLE public.course_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quizzes public read" ON public.course_quizzes FOR SELECT USING (true);
CREATE POLICY "quizzes staff write" ON public.course_quizzes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.course_quizzes(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'mcq',
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_option integer,
  explanation text,
  practice_question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- answer key stays server-side: no anon/authenticated grants beyond staff policy
GRANT SELECT ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quiz questions staff only" ON public.quiz_questions FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.course_quizzes(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quiz_attempts_user_quiz_idx ON public.quiz_attempts (user_id, quiz_id);
GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts read" ON public.quiz_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "own attempts insert" ON public.quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============ CERTIFICATES ============
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  certificate_code text NOT NULL UNIQUE,
  UNIQUE (user_id, course_id)
);
GRANT SELECT ON public.certificates TO anon, authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificates public read" ON public.certificates FOR SELECT USING (true);

-- ============ LEARNING PATHS ============
CREATE TABLE public.learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  thumbnail_url text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.learning_paths TO anon, authenticated;
GRANT ALL ON public.learning_paths TO service_role;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "paths public read" ON public.learning_paths FOR SELECT USING (true);
CREATE POLICY "paths staff write" ON public.learning_paths FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.learning_path_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  UNIQUE (path_id, course_id)
);
GRANT SELECT ON public.learning_path_courses TO anon, authenticated;
GRANT ALL ON public.learning_path_courses TO service_role;
ALTER TABLE public.learning_path_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "path courses public read" ON public.learning_path_courses FOR SELECT USING (true);
CREATE POLICY "path courses staff write" ON public.learning_path_courses FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ COMPLETION CHECK ============
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
  WHERE cs.course_id = _course_id AND lp.user_id = _user_id;

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

-- ============ SEED: LEARNING PATHS ============
INSERT INTO public.learning_paths (title, description, order_index) VALUES
  ('ICPC Prep Track', 'Go from language fluency to contest-ready problem solving: Python for problem solving, then a full C++ competitive programming deep dive.', 0),
  ('Full-Stack JavaScript Track', 'Master modern JavaScript from the runtime up, then broaden into strongly typed backend thinking with Java.', 1),
  ('Programming Foundations', 'A gentle start for new students: Python basics, then object-oriented thinking with Java.', 2);

INSERT INTO public.learning_path_courses (path_id, course_id, order_index)
SELECT p.id, c.id, x.ord FROM (VALUES
  ('ICPC Prep Track', 'Python for Problem Solving', 0),
  ('ICPC Prep Track', 'C++ for Competitive Programming', 1),
  ('Full-Stack JavaScript Track', 'JavaScript Fundamentals to Advanced', 0),
  ('Full-Stack JavaScript Track', 'Java Essentials', 1),
  ('Programming Foundations', 'Python for Problem Solving', 0),
  ('Programming Foundations', 'Java Essentials', 1),
  ('Programming Foundations', 'JavaScript Fundamentals to Advanced', 2)
) AS x(path_title, course_title, ord)
JOIN public.learning_paths p ON p.title = x.path_title
JOIN public.courses c ON c.title = x.course_title;

-- ============ SEED: QUIZZES ============
INSERT INTO public.course_quizzes (lesson_id, title, pass_threshold)
SELECT id, 'Check your understanding', 70 FROM public.course_lessons
WHERE id IN (
  'd8848b4f-5eb4-43bc-9073-f9abb885f554',
  '0179cabe-80bd-48d3-892f-a01e34ef92e0',
  '8f8a27bd-c678-4a89-9926-8af64612a4df',
  '8a5642a9-ff0b-4ff2-b01a-e847ae549689',
  'ca139422-8660-4424-97ae-cc83b4b088b8',
  '4cafb05e-13cf-49fc-87ab-a48b61442f74'
);

INSERT INTO public.quiz_questions (quiz_id, question_text, options, correct_option, explanation, order_index)
SELECT q.id, x.qt, x.opts::jsonb, x.correct, x.expl, x.ord
FROM (VALUES
  ('d8848b4f-5eb4-43bc-9073-f9abb885f554', 'What does the JavaScript engine''s event loop primarily do?', '["Compiles JS to machine code","Coordinates the call stack and task queues","Allocates memory for objects","Type-checks your code"]', 1, 'The event loop moves queued callbacks onto the call stack once it is empty.', 0),
  ('d8848b4f-5eb4-43bc-9073-f9abb885f554', 'Which of these is NOT a JavaScript runtime?', '["Node.js","Deno","Bun","Pandas"]', 3, 'Pandas is a Python data analysis library, not a JS runtime.', 1),
  ('d8848b4f-5eb4-43bc-9073-f9abb885f554', 'JavaScript is best described as:', '["Statically typed and compiled ahead of time","Dynamically typed and JIT compiled","Strongly typed and interpreted only","Untyped assembly"]', 1, 'Modern engines like V8 JIT-compile dynamically typed JavaScript.', 2),

  ('0179cabe-80bd-48d3-892f-a01e34ef92e0', 'Which command runs a Python file called main.py?', '["run main.py","python main.py","exec main","py-run main.py"]', 1, 'The interpreter is invoked as python (or python3) followed by the file.', 0),
  ('0179cabe-80bd-48d3-892f-a01e34ef92e0', 'What does the REPL stand for?', '["Read Eval Print Loop","Run Every Python Line","Remote Execution Python Layer","Recursive Expression Parser Language"]', 0, 'The REPL reads input, evaluates it, prints the result, and loops.', 1),
  ('0179cabe-80bd-48d3-892f-a01e34ef92e0', 'Which is a valid way to read a full line of input?', '["read()","input()","scan()","gets()"]', 1, 'input() reads one line from standard input as a string.', 2),
  ('0179cabe-80bd-48d3-892f-a01e34ef92e0', 'Python indentation is:', '["Optional styling","Syntactically meaningful","Only needed in functions","Ignored by the interpreter"]', 1, 'Indentation defines block structure in Python.', 3),

  ('8f8a27bd-c678-4a89-9926-8af64612a4df', 'What is the JVM responsible for?', '["Writing Java source files","Executing compiled bytecode","Formatting your code","Managing your IDE"]', 1, 'The JVM executes .class bytecode produced by javac.', 0),
  ('8f8a27bd-c678-4a89-9926-8af64612a4df', 'The JDK contains:', '["Only the runtime","The compiler and the runtime","Only the compiler","Just documentation"]', 1, 'The JDK bundles javac plus the JRE.', 1),
  ('8f8a27bd-c678-4a89-9926-8af64612a4df', 'Which signature starts a Java program?', '["public static void main(String[] args)","function main()","def main():","int main()"]', 0, 'Java entry points use public static void main(String[] args).', 2),

  ('8a5642a9-ff0b-4ff2-b01a-e847ae549689', 'Why do competitive programmers use a prewritten template?', '["It scores extra points","It saves setup time under contest pressure","It is required by judges","It makes code run faster"]', 1, 'Templates remove repetitive boilerplate so you can focus on the algorithm.', 0),
  ('8a5642a9-ff0b-4ff2-b01a-e847ae549689', 'Which header pulls in most of the C++ standard library on GCC?', '["<iostream>","<bits/stdc++.h>","<vector>","<algorithm>"]', 1, '<bits/stdc++.h> is a GCC convenience header including nearly everything.', 1),
  ('8a5642a9-ff0b-4ff2-b01a-e847ae549689', 'Typical safe integer type for large sums in CP:', '["short","int","long long","char"]', 2, 'long long holds up to about 9.2e18, avoiding overflow in most problems.', 2),

  ('ca139422-8660-4424-97ae-cc83b4b088b8', 'A prefix sum array lets you answer range-sum queries in:', '["O(n) per query","O(log n) per query","O(1) per query","O(n log n) per query"]', 2, 'pre[r+1] - pre[l] answers any range sum in constant time.', 0),
  ('ca139422-8660-4424-97ae-cc83b4b088b8', 'A difference array is best for:', '["Point queries only","Many range updates then one final read","Sorting","Graph traversal"]', 1, 'Difference arrays make range updates O(1) with a single prefix pass at the end.', 1),
  ('ca139422-8660-4424-97ae-cc83b4b088b8', 'Building a prefix sum array costs:', '["O(1)","O(log n)","O(n)","O(n^2)"]', 2, 'One linear pass builds the whole array.', 2),

  ('4cafb05e-13cf-49fc-87ab-a48b61442f74', 'Binary search on the answer requires the predicate to be:', '["Random","Monotonic","Constant","Strictly increasing by 1"]', 1, 'You need a monotonic true/false boundary to binary search over.', 0),
  ('4cafb05e-13cf-49fc-87ab-a48b61442f74', 'Total complexity of binary searching an answer with an O(n) check over range R:', '["O(n)","O(n log R)","O(R)","O(n^2)"]', 1, 'Each of the log R iterations runs the O(n) feasibility check.', 1),
  ('4cafb05e-13cf-49fc-87ab-a48b61442f74', 'A common bug in binary search is:', '["Using a while loop","Infinite loops from bad mid/boundary updates","Using integers","Checking feasibility"]', 1, 'Careless lo/hi updates with mid rounding cause infinite loops.', 2)
) AS x(lesson_id, qt, opts, correct, expl, ord)
JOIN public.course_quizzes q ON q.lesson_id = x.lesson_id::uuid;
