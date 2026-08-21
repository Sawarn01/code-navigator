
-- 1. event_registrations
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own registrations" ON public.event_registrations
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "users create own registrations" ON public.event_registrations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own registrations" ON public.event_registrations
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- 2. lesson_progress
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own lesson progress" ON public.lesson_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own lesson progress" ON public.lesson_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own lesson progress" ON public.lesson_progress
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. lesson practice topic
ALTER TABLE public.course_lessons ADD COLUMN IF NOT EXISTS practice_topic text;
ALTER TABLE public.course_lessons ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 12;

-- 4. seed courses
DO $$
DECLARE
  cid uuid; sid uuid;
  js uuid; py uuid; jv uuid; cpp uuid;
  s jsonb; l jsonb; c jsonb;
  si int; li int;
  payload jsonb;
BEGIN
  SELECT id INTO js FROM public.languages WHERE slug = 'javascript';
  SELECT id INTO py FROM public.languages WHERE slug = 'python';
  SELECT id INTO jv FROM public.languages WHERE slug = 'java';
  SELECT id INTO cpp FROM public.languages WHERE slug = 'cpp';

  payload := jsonb_build_array(
    jsonb_build_object('lang', js, 'title', 'JavaScript Fundamentals to Advanced',
      'desc', 'Go from syntax basics to closures, async patterns and the event loop, with practice after every topic.',
      'sections', jsonb_build_array(
        jsonb_build_object('title','Getting Started','lessons', jsonb_build_array(
          jsonb_build_object('t','What JavaScript actually runs on','v','W6NZfCO5SIk','p','variables'),
          jsonb_build_object('t','Variables, let, const and scope','v','9emXNzqCKyg','p','variables'),
          jsonb_build_object('t','Primitive types and coercion','v','PLACEHOLDER_JS_03','p','types')
        )),
        jsonb_build_object('title','Functions and Scope','lessons', jsonb_build_array(
          jsonb_build_object('t','Function declarations vs expressions','v','N8ap4k_1QEQ','p','functions'),
          jsonb_build_object('t','Arrow functions and this','v','PLACEHOLDER_JS_05','p','functions'),
          jsonb_build_object('t','Closures explained','v','3a0I8ICR1Vg','p','closure'),
          jsonb_build_object('t','Higher order functions','v','PLACEHOLDER_JS_07','p','array')
        )),
        jsonb_build_object('title','Arrays and Objects','lessons', jsonb_build_array(
          jsonb_build_object('t','Array methods you will actually use','v','R8rmfD9Y5-c','p','array'),
          jsonb_build_object('t','Objects, destructuring and spread','v','PLACEHOLDER_JS_09','p','object'),
          jsonb_build_object('t','Map, Set and when to reach for them','v','PLACEHOLDER_JS_10','p','map')
        )),
        jsonb_build_object('title','Asynchronous JavaScript','lessons', jsonb_build_array(
          jsonb_build_object('t','The event loop','v','8aGhZQkoFbQ','p','async'),
          jsonb_build_object('t','Promises from scratch','v','DHvZLI7Db8E','p','promise'),
          jsonb_build_object('t','async / await patterns','v','V_Kr9OSfDeU','p','async'),
          jsonb_build_object('t','Fetching data and error handling','v','PLACEHOLDER_JS_14','p','fetch')
        )),
        jsonb_build_object('title','Interview Ready','lessons', jsonb_build_array(
          jsonb_build_object('t','Common JS interview traps','v','PLACEHOLDER_JS_15','p','string'),
          jsonb_build_object('t','Writing testable utility functions','v','PLACEHOLDER_JS_16','p','functions'),
          jsonb_build_object('t','Mock interview walkthrough','v','PLACEHOLDER_JS_17','p','array')
        ))
      )),
    jsonb_build_object('lang', py, 'title', 'Python for Problem Solving',
      'desc', 'Python from the ground up, aimed squarely at interview questions and algorithmic problem solving.',
      'sections', jsonb_build_array(
        jsonb_build_object('title','Python Basics','lessons', jsonb_build_array(
          jsonb_build_object('t','Setting up and running Python','v','rfscVS0vtbw','p','print'),
          jsonb_build_object('t','Numbers, strings and f-strings','v','PLACEHOLDER_PY_02','p','string'),
          jsonb_build_object('t','Control flow and loops','v','PLACEHOLDER_PY_03','p','loop')
        )),
        jsonb_build_object('title','Core Data Structures','lessons', jsonb_build_array(
          jsonb_build_object('t','Lists and slicing','v','PLACEHOLDER_PY_04','p','list'),
          jsonb_build_object('t','Dictionaries and sets','v','daefaLgNkw0','p','dictionary'),
          jsonb_build_object('t','Tuples, unpacking and comprehensions','v','PLACEHOLDER_PY_06','p','comprehension'),
          jsonb_build_object('t','collections: Counter, deque, defaultdict','v','PLACEHOLDER_PY_07','p','counter')
        )),
        jsonb_build_object('title','Functions and Idioms','lessons', jsonb_build_array(
          jsonb_build_object('t','Functions, args and kwargs','v','PLACEHOLDER_PY_08','p','function'),
          jsonb_build_object('t','Lambdas, map, filter, sorted keys','v','PLACEHOLDER_PY_09','p','sort'),
          jsonb_build_object('t','Generators and iterators','v','bD05uGo_sVI','p','generator')
        )),
        jsonb_build_object('title','Algorithmic Patterns','lessons', jsonb_build_array(
          jsonb_build_object('t','Two pointers and sliding window','v','PLACEHOLDER_PY_11','p','two sum'),
          jsonb_build_object('t','Hash map counting patterns','v','PLACEHOLDER_PY_12','p','anagram'),
          jsonb_build_object('t','Recursion and memoisation','v','PLACEHOLDER_PY_13','p','fibonacci'),
          jsonb_build_object('t','Sorting and binary search','v','PLACEHOLDER_PY_14','p','search')
        )),
        jsonb_build_object('title','Wrapping Up','lessons', jsonb_build_array(
          jsonb_build_object('t','Reading problem statements carefully','v','PLACEHOLDER_PY_15','p','string'),
          jsonb_build_object('t','Timing and complexity in Python','v','PLACEHOLDER_PY_16','p','list')
        ))
      )),
    jsonb_build_object('lang', jv, 'title', 'Java Essentials',
      'desc', 'Object-oriented Java for interviews: types, collections, OOP design and the streams API.',
      'sections', jsonb_build_array(
        jsonb_build_object('title','Java Foundations','lessons', jsonb_build_array(
          jsonb_build_object('t','JVM, JDK and your first class','v','eIrMbAQSU34','p','hello'),
          jsonb_build_object('t','Primitives, wrappers and casting','v','PLACEHOLDER_JV_02','p','types'),
          jsonb_build_object('t','Control flow and arrays','v','PLACEHOLDER_JV_03','p','array')
        )),
        jsonb_build_object('title','Object Oriented Java','lessons', jsonb_build_array(
          jsonb_build_object('t','Classes, constructors and encapsulation','v','PLACEHOLDER_JV_04','p','class'),
          jsonb_build_object('t','Inheritance and polymorphism','v','PLACEHOLDER_JV_05','p','inheritance'),
          jsonb_build_object('t','Interfaces and abstract classes','v','PLACEHOLDER_JV_06','p','interface')
        )),
        jsonb_build_object('title','Collections Framework','lessons', jsonb_build_array(
          jsonb_build_object('t','List, ArrayList and LinkedList','v','PLACEHOLDER_JV_07','p','list'),
          jsonb_build_object('t','HashMap and HashSet internals','v','PLACEHOLDER_JV_08','p','map'),
          jsonb_build_object('t','Sorting with Comparator','v','PLACEHOLDER_JV_09','p','sort'),
          jsonb_build_object('t','Queues, stacks and deques','v','PLACEHOLDER_JV_10','p','stack')
        )),
        jsonb_build_object('title','Modern Java','lessons', jsonb_build_array(
          jsonb_build_object('t','Lambdas and functional interfaces','v','PLACEHOLDER_JV_11','p','lambda'),
          jsonb_build_object('t','Streams API in practice','v','PLACEHOLDER_JV_12','p','stream'),
          jsonb_build_object('t','Optional and null safety','v','PLACEHOLDER_JV_13','p','optional')
        )),
        jsonb_build_object('title','Interview Prep','lessons', jsonb_build_array(
          jsonb_build_object('t','String manipulation questions','v','PLACEHOLDER_JV_14','p','string'),
          jsonb_build_object('t','Exception handling done right','v','PLACEHOLDER_JV_15','p','exception')
        ))
      )),
    jsonb_build_object('lang', cpp, 'title', 'C++ for Competitive Programming',
      'desc', 'Contest-focused C++: fast IO, the STL, complexity discipline and the classic algorithm toolbox.',
      'sections', jsonb_build_array(
        jsonb_build_object('title','Contest Setup','lessons', jsonb_build_array(
          jsonb_build_object('t','Your competitive C++ template','v','ZWlHfx0Xzoo','p','hello'),
          jsonb_build_object('t','Fast input and output','v','PLACEHOLDER_CP_02','p','input'),
          jsonb_build_object('t','Reading constraints to pick a complexity','v','PLACEHOLDER_CP_03','p','complexity')
        )),
        jsonb_build_object('title','STL Mastery','lessons', jsonb_build_array(
          jsonb_build_object('t','vector, pair and iterators','v','PLACEHOLDER_CP_04','p','vector'),
          jsonb_build_object('t','map, set and multiset','v','PLACEHOLDER_CP_05','p','set'),
          jsonb_build_object('t','sort, lower_bound and custom comparators','v','PLACEHOLDER_CP_06','p','sort'),
          jsonb_build_object('t','priority_queue and heaps','v','PLACEHOLDER_CP_07','p','heap')
        )),
        jsonb_build_object('title','Core Algorithms','lessons', jsonb_build_array(
          jsonb_build_object('t','Prefix sums and difference arrays','v','PLACEHOLDER_CP_08','p','prefix'),
          jsonb_build_object('t','Binary search on the answer','v','PLACEHOLDER_CP_09','p','binary search'),
          jsonb_build_object('t','Two pointers and sliding window','v','PLACEHOLDER_CP_10','p','window'),
          jsonb_build_object('t','Greedy proofs and pitfalls','v','PLACEHOLDER_CP_11','p','greedy')
        )),
        jsonb_build_object('title','Graphs','lessons', jsonb_build_array(
          jsonb_build_object('t','Graph representations','v','PLACEHOLDER_CP_12','p','graph'),
          jsonb_build_object('t','BFS and DFS templates','v','PLACEHOLDER_CP_13','p','bfs'),
          jsonb_build_object('t','Shortest paths with Dijkstra','v','PLACEHOLDER_CP_14','p','dijkstra')
        )),
        jsonb_build_object('title','Dynamic Programming','lessons', jsonb_build_array(
          jsonb_build_object('t','From recursion to DP','v','PLACEHOLDER_CP_15','p','dp'),
          jsonb_build_object('t','Knapsack family','v','PLACEHOLDER_CP_16','p','knapsack'),
          jsonb_build_object('t','DP on subsequences','v','PLACEHOLDER_CP_17','p','subsequence')
        ))
      ))
  );

  FOR c IN SELECT * FROM jsonb_array_elements(payload) LOOP
    SELECT id INTO cid FROM public.courses WHERE title = c->>'title';
    IF cid IS NOT NULL THEN CONTINUE; END IF;
    INSERT INTO public.courses (language_id, title, description)
    VALUES ((c->>'lang')::uuid, c->>'title', c->>'desc')
    RETURNING id INTO cid;

    si := 0;
    FOR s IN SELECT * FROM jsonb_array_elements(c->'sections') LOOP
      INSERT INTO public.course_sections (course_id, title, order_index)
      VALUES (cid, s->>'title', si) RETURNING id INTO sid;
      si := si + 1;
      li := 0;
      FOR l IN SELECT * FROM jsonb_array_elements(s->'lessons') LOOP
        INSERT INTO public.course_lessons (section_id, title, youtube_video_id, order_index, has_practice, practice_topic, duration_minutes)
        VALUES (sid, l->>'t', l->>'v', li, true, l->>'p', 8 + (li * 3));
        li := li + 1;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- 5. seed events
INSERT INTO public.events (title, description, type, start_time, end_time, location, registration_link)
SELECT * FROM (VALUES
  ('Saturday Day Hackathon: API Sprint',
   'The weekly daytime shift. Ship a working REST API from an empty repo in eight hours, judged on correctness, tests and clarity. Teams of two or solo.',
   'saturday-day', now() + interval '3 days' + interval '10 hours', now() + interval '3 days' + interval '18 hours', 'Zenith Campus, Lab 2', null),
  ('Saturday Night Hackathon: Algorithms After Dark',
   'The night shift for the nocturnal crowd. Six hours of escalating algorithmic challenges, caffeine provided, scoreboard frozen for the last hour.',
   'saturday-night', now() + interval '3 days' + interval '20 hours', now() + interval '4 days' + interval '2 hours', 'Zenith Campus, Lab 2', null),
  ('Mini-Hackathon: Build a CLI Tool',
   'A tight three-hour sprint. Pick any language, ship a command line tool that does one thing genuinely well. Demos at the end.',
   'mini-hackathon', now() + interval '8 days' + interval '15 hours', now() + interval '8 days' + interval '18 hours', 'Zenith Campus, Studio A', null),
  ('Virtual ICPC Warmup Round',
   'A five-problem virtual contest mirroring regional ICPC difficulty. Editorial session streamed immediately after the scoreboard unfreezes.',
   'virtual', now() + interval '11 days' + interval '17 hours', now() + interval '11 days' + interval '22 hours', null, 'https://meet.zenithschool.ai/icpc-warmup'),
  ('Offline Interview Bootcamp Day',
   'Mock technical interviews with alumni engineers, back to back, with written feedback on each round. Bring a laptop and a printed resume.',
   'offline', now() + interval '17 days' + interval '9 hours', now() + interval '17 days' + interval '17 hours', 'Zenith Campus, Auditorium', null),
  ('Virtual Hack Night: Data Structures Duel',
   'Head to head bracket. Two students, one problem, one shared scoreboard. Losers move to the consolation ladder, nobody goes home early.',
   'virtual', now() + interval '24 days' + interval '19 hours', now() + interval '24 days' + interval '23 hours', null, 'https://meet.zenithschool.ai/ds-duel'),
  ('Saturday Day Hackathon: Frontend Rebuild',
   'Rebuild a well known product landing page from screenshots alone. Judged on fidelity, responsiveness and accessibility.',
   'saturday-day', now() - interval '11 days', now() - interval '11 days' + interval '8 hours', 'Zenith Campus, Lab 2', null),
  ('Saturday Night Hackathon: Graph Gauntlet',
   'Eight graph problems, six hours, one very tired scoreboard. Won by a first-year on tiebreak.',
   'saturday-night', now() - interval '18 days', now() - interval '18 days' + interval '6 hours', 'Zenith Campus, Lab 2', null),
  ('Mini-Hackathon: Regex Rumble',
   'Three hours of pattern matching puzzles, from log parsing to tokenising a tiny language.',
   'mini-hackathon', now() - interval '26 days', now() - interval '26 days' + interval '3 hours', 'Zenith Campus, Studio A', null),
  ('Virtual New Semester Kickoff Contest',
   'The opening contest of the term. Four problems, gentle ramp, designed to get first-years onto the scoreboard.',
   'virtual', now() - interval '40 days', now() - interval '40 days' + interval '4 hours', null, 'https://meet.zenithschool.ai/kickoff')
) AS v(title, description, type, start_time, end_time, location, registration_link)
WHERE NOT EXISTS (SELECT 1 FROM public.events e WHERE e.title = v.title);
