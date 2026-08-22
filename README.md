# Code Navigator

Build a platform called "Space" — a practice and competition platform for coding students preparing for technical interviews and competitive programming contests (like ICPC). TECH STACK - Frontend: React + TypeScript + Tailwind CSS - Animation: Framer Motion for all transitions, hover states, page-load reveals, and micro-interactions - Backend/DB/Auth: Supabase (Postgres + Supabase Auth + Row Level Security) - Code execution (added in a later phase): Judge0 API via Supabase Edge Functions DESIGN SYSTEM (apply globally, to every screen from here on) - Background: white (#FFFFFF) as the dominant surface color - Primary accent: Indigo (use a proper Indigo scale — Indigo-50 for subtle backgrounds/hover states, Indigo-500/600 for primary buttons and active states, Indigo-700 for text-on-white emphasis, Indigo-900 for headings) - Typography: clean sans-serif (Inter or similar), strong heading hierarchy, generous whitespace - Layout pattern: use a BENTO GRID layout for dashboards, landing page feature sections, and profile pages — asymmetric card sizes, rounded-2xl corners, soft shadows, subtle indigo borders on hover - Every card/section should have a Framer Motion entrance animation (fade+slide on scroll into view), and interactive elements (buttons, cards, nav links) should have hover/tap micro-animations (scale, glow, or color shift) - Avoid clutter — one clear focal action per screen - Fully responsive (mobile, tablet, desktop) CORE DATA MODEL (set up in Supabase now, even though UI comes in later phases) Create these tables with Row Level Security enabled: - profiles (id uuid references auth.users, full_name, avatar_url, bio, role text check in ('student','manager','admin'), points integer default 0, created_at) - languages (id, name, slug, icon_url) — seed with: JavaScript, Python, Java, C++, C, TypeScript, Go, SQL - dictionary_terms (id, language_id nullable for "general CS", term, definition, example_code, tags[]) - reference_links (id, language_id, title, url, source text e.g. "MDN"/"Official Docs"/"StackOverflow", description) - questions (id, title, slug, language_id, difficulty text check in ('easy','medium','hard'), description, constraints, starter_code, points integer, category text check in ('practice','cp'), created_at) - test_cases (id, question_id, input, expected_output, is_sample boolean, is_hidden boolean) - submissions (id, user_id, question_id, code, language, status text, runtime_ms, points_awarded, submitted_at) - badges (id, name, description, icon_url, criteria_description) - user_badges (id, user_id, badge_id, awarded_at) - forum_posts (id, user_id, title, body, tags[], created_at, upvotes integer default 0) - forum_replies (id, post_id, user_id, body, created_at, upvotes integer default 0) - events (id, title, description, type text check in ('mini-hackathon','saturday-day','saturday-night','virtual','offline'), start_time, end_time, location text nullable, registration_link, banner_url) - courses (id, language_id, title, description, thumbnail_url) - course_sections (id, course_id, title, order_index) - course_lessons (id, section_id, title, youtube_video_id, order_index, has_practice boolean) RLS BASICS - profiles: users can read all, update only their own row - role field can only be changed by an 'admin' role (enforce via policy, not client-side) - submissions: users can insert their own, read only their own (leaderboard uses an aggregated view, not raw submissions) - everything else (questions, dictionary, reference, courses, events): public read, write restricted to 'admin' and 'manager' roles Do NOT build any pages yet beyond a placeholder home route confirming the project scaffolds correctly and Supabase connects. Just set up the design tokens, base layout shell (header placeholder, white bg, indigo theme), and the database schema above. I will send the next phase after confirming this works.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6a8a41d5-f3a6-4769-a2e5-bd27fa8d98b6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
