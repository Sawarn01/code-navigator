create table public.allowed_email_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.allowed_email_domains to authenticated;
grant all on public.allowed_email_domains to service_role;
alter table public.allowed_email_domains enable row level security;
create policy "admins manage domains" on public.allowed_email_domains for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.allowed_email_domains (domain) values ('zenithschool.ai');

-- Enforce allowlist + default student role at the database level
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  if not exists (select 1 from public.allowed_email_domains d where d.domain = _domain) then
    raise exception 'Sign-up restricted to approved institutional email domains';
  end if;

  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  return new;
end; $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- SEED: badges
insert into public.badges (name, description, criteria_description) values
 ('First Blood','Submitted your very first accepted solution.','Solve 1 question'),
 ('Streak Starter','Practiced 7 days in a row.','7-day practice streak'),
 ('Algorithm Ace','Cleared 25 medium difficulty problems.','25 medium solves'),
 ('Contest Warrior','Competed in 3 hackathons or contests.','3 event participations'),
 ('Polyglot','Solved problems in 4 different languages.','4 languages used');

-- SEED: events
insert into public.events (title, description, type, start_time, end_time, location, registration_link) values
 ('Saturday Night Sprint','A 3-hour timed contest with ICPC-style problems.','saturday-night', now() + interval '4 days', now() + interval '4 days 3 hours', 'Online', '#'),
 ('Mini Hackathon: Graphs','Build and optimise graph algorithms under pressure.','mini-hackathon', now() + interval '11 days', now() + interval '11 days 6 hours', 'Lab 2, Zenith Campus', '#'),
 ('Saturday Day Lab','Guided practice session on dynamic programming.','saturday-day', now() + interval '18 days', now() + interval '18 days 5 hours', 'Zenith Campus', '#'),
 ('Virtual Interview Gauntlet','Timed mock technical interview rounds.','virtual', now() + interval '25 days', now() + interval '25 days 4 hours', 'Online', '#');

-- SEED: questions
insert into public.questions (title, slug, language_id, difficulty, description, constraints, starter_code, points, category)
select v.title, v.slug, l.id, v.difficulty, v.description, v.constraints, v.starter_code, v.points, v.category
from (values
 ('Two Sum','two-sum','python','easy','Return indices of the two numbers adding up to target.','2 <= n <= 10^4','def two_sum(nums, target):\n    pass',10,'practice'),
 ('Valid Parentheses','valid-parentheses','javascript','easy','Determine if the input string has valid bracket matching.','1 <= n <= 10^4','function isValid(s) {}',10,'practice'),
 ('Longest Substring Without Repeats','longest-substring','java','medium','Find the length of the longest substring without repeating characters.','0 <= n <= 5*10^4','class Solution {}',25,'practice'),
 ('Shortest Path in Weighted Graph','shortest-path','cpp','medium','Implement Dijkstra to find shortest distances from a source node.','1 <= n <= 10^5','int main() { return 0; }',30,'cp'),
 ('Maximum Flow','maximum-flow','cpp','hard','Compute the maximum flow between source and sink.','1 <= n <= 500','int main() { return 0; }',50,'cp'),
 ('Employee Salary Ranking','employee-salary-ranking','sql','medium','Rank employees by salary within each department.','n <= 10^5','SELECT 1;',25,'practice')
) as v(title, slug, lang_slug, difficulty, description, constraints, starter_code, points, category)
join public.languages l on l.slug = v.lang_slug;