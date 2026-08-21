-- ROLES
create type public.app_role as enum ('student','manager','admin');

create or replace function public.update_updated_at_column()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql set search_path = public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  bio text,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by everyone" on public.profiles for select using (true);
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'student',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','manager'))
$$;

create policy "users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- new user trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- LANGUAGES
create table public.languages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon_url text,
  created_at timestamptz not null default now()
);
grant select on public.languages to anon, authenticated;
grant all on public.languages to service_role;
alter table public.languages enable row level security;
create policy "languages public read" on public.languages for select using (true);
create policy "languages staff write" on public.languages for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
insert into public.languages (name, slug) values
 ('JavaScript','javascript'),('Python','python'),('Java','java'),('C++','cpp'),
 ('C','c'),('TypeScript','typescript'),('Go','go'),('SQL','sql');

-- DICTIONARY
create table public.dictionary_terms (
  id uuid primary key default gen_random_uuid(),
  language_id uuid references public.languages(id) on delete set null,
  term text not null,
  definition text not null,
  example_code text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.dictionary_terms to anon, authenticated;
grant all on public.dictionary_terms to service_role;
alter table public.dictionary_terms enable row level security;
create policy "dictionary public read" on public.dictionary_terms for select using (true);
create policy "dictionary staff write" on public.dictionary_terms for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create trigger dictionary_updated_at before update on public.dictionary_terms for each row execute function public.update_updated_at_column();

-- REFERENCE LINKS
create table public.reference_links (
  id uuid primary key default gen_random_uuid(),
  language_id uuid references public.languages(id) on delete cascade,
  title text not null,
  url text not null,
  source text,
  description text,
  created_at timestamptz not null default now()
);
grant select on public.reference_links to anon, authenticated;
grant all on public.reference_links to service_role;
alter table public.reference_links enable row level security;
create policy "reference public read" on public.reference_links for select using (true);
create policy "reference staff write" on public.reference_links for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- QUESTIONS
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  language_id uuid references public.languages(id) on delete set null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  description text not null,
  constraints text,
  starter_code text,
  points integer not null default 10,
  category text not null default 'practice' check (category in ('practice','cp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.questions to anon, authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;
create policy "questions public read" on public.questions for select using (true);
create policy "questions staff write" on public.questions for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create trigger questions_updated_at before update on public.questions for each row execute function public.update_updated_at_column();

-- TEST CASES
create table public.test_cases (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  input text,
  expected_output text,
  is_sample boolean not null default false,
  is_hidden boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.test_cases to anon, authenticated;
grant all on public.test_cases to service_role;
alter table public.test_cases enable row level security;
create policy "sample test cases public read" on public.test_cases for select using (is_hidden = false);
create policy "test cases staff read all" on public.test_cases for select to authenticated using (public.is_staff(auth.uid()));
create policy "test cases staff write" on public.test_cases for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- SUBMISSIONS
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  code text not null,
  language text,
  status text,
  runtime_ms integer,
  points_awarded integer not null default 0,
  submitted_at timestamptz not null default now()
);
grant select, insert on public.submissions to authenticated;
grant all on public.submissions to service_role;
alter table public.submissions enable row level security;
create policy "users read own submissions" on public.submissions for select to authenticated using (auth.uid() = user_id);
create policy "users insert own submissions" on public.submissions for insert to authenticated with check (auth.uid() = user_id);

-- BADGES
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon_url text,
  criteria_description text,
  created_at timestamptz not null default now()
);
grant select on public.badges to anon, authenticated;
grant all on public.badges to service_role;
alter table public.badges enable row level security;
create policy "badges public read" on public.badges for select using (true);
create policy "badges staff write" on public.badges for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);
grant select on public.user_badges to anon, authenticated;
grant all on public.user_badges to service_role;
alter table public.user_badges enable row level security;
create policy "user badges public read" on public.user_badges for select using (true);
create policy "user badges staff write" on public.user_badges for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- FORUM
create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  upvotes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.forum_posts to anon;
grant select, insert, update, delete on public.forum_posts to authenticated;
grant all on public.forum_posts to service_role;
alter table public.forum_posts enable row level security;
create policy "forum posts public read" on public.forum_posts for select using (true);
create policy "users create own posts" on public.forum_posts for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own posts" on public.forum_posts for update to authenticated using (auth.uid() = user_id or public.is_staff(auth.uid())) with check (auth.uid() = user_id or public.is_staff(auth.uid()));
create policy "users delete own posts" on public.forum_posts for delete to authenticated using (auth.uid() = user_id or public.is_staff(auth.uid()));
create trigger forum_posts_updated_at before update on public.forum_posts for each row execute function public.update_updated_at_column();

create table public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  upvotes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.forum_replies to anon;
grant select, insert, update, delete on public.forum_replies to authenticated;
grant all on public.forum_replies to service_role;
alter table public.forum_replies enable row level security;
create policy "forum replies public read" on public.forum_replies for select using (true);
create policy "users create own replies" on public.forum_replies for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own replies" on public.forum_replies for update to authenticated using (auth.uid() = user_id or public.is_staff(auth.uid())) with check (auth.uid() = user_id or public.is_staff(auth.uid()));
create policy "users delete own replies" on public.forum_replies for delete to authenticated using (auth.uid() = user_id or public.is_staff(auth.uid()));
create trigger forum_replies_updated_at before update on public.forum_replies for each row execute function public.update_updated_at_column();

-- EVENTS
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type text not null check (type in ('mini-hackathon','saturday-day','saturday-night','virtual','offline')),
  start_time timestamptz not null,
  end_time timestamptz,
  location text,
  registration_link text,
  banner_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.events to anon, authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events public read" on public.events for select using (true);
create policy "events staff write" on public.events for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create trigger events_updated_at before update on public.events for each row execute function public.update_updated_at_column();

-- COURSES
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  language_id uuid references public.languages(id) on delete set null,
  title text not null,
  description text,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.courses to anon, authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;
create policy "courses public read" on public.courses for select using (true);
create policy "courses staff write" on public.courses for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create trigger courses_updated_at before update on public.courses for each row execute function public.update_updated_at_column();

create table public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.course_sections to anon, authenticated;
grant all on public.course_sections to service_role;
alter table public.course_sections enable row level security;
create policy "sections public read" on public.course_sections for select using (true);
create policy "sections staff write" on public.course_sections for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.course_sections(id) on delete cascade,
  title text not null,
  youtube_video_id text,
  order_index integer not null default 0,
  has_practice boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.course_lessons to anon, authenticated;
grant all on public.course_lessons to service_role;
alter table public.course_lessons enable row level security;
create policy "lessons public read" on public.course_lessons for select using (true);
create policy "lessons staff write" on public.course_lessons for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- LEADERBOARD VIEW (aggregated, no raw submissions)
create view public.leaderboard
with (security_invoker = on) as
select p.id as user_id, p.full_name, p.avatar_url, p.points
from public.profiles p;
grant select on public.leaderboard to anon, authenticated;