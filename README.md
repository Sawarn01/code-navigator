# Space

Space is a practice and competition platform for coding students preparing for technical interviews and competitive programming contests. It combines graded practice problems, a competitive programming zone, structured video courses, community features, and mentorship into one product.

## Features

- **Practice & CP Zone** — graded coding problems across JavaScript, Python, Java, C++, C, TypeScript, Go and SQL, with instant execution against sample and hidden test cases, per-question hints and editorials, and a daily featured challenge.
- **Competitive programming rating** — a simple ELO-style rating that moves with every solved CP problem.
- **Leaderboards** — global, per-topic, per-study-group, and group-vs-group rankings, with an opt-out for students who'd rather not appear.
- **Learning** — video courses organized into sections and lessons, quizzes, certificates, learning paths, prerequisites, and drip-scheduled releases.
- **Community** — a forum with upvotes, tags and accepted-answer marking, study groups with their own discussion and challenges, and a unified activity feed.
- **Events** — hackathons and meetups with capacity, waitlisting, attendance tracking, feedback, and reminder emails.
- **Mentorship** — mentor/mentee pairing, private notes, and bookable 1:1 sessions.
- **Gamification** — badges, streaks, and points that tie the whole platform together.

## Tech stack

- **Frontend**: React 19 + TypeScript, TanStack Start (SSR) + TanStack Router, Tailwind CSS v4, Framer Motion
- **Backend**: TanStack Start server functions, Supabase (Postgres, Auth, Row Level Security)
- **Code execution**: a self-hosted Piston instance for running and grading submissions
- **Email**: Resend, scheduled via Postgres `pg_cron`/`pg_net`

## Development

You'll need Node.js (or Bun) installed.

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in your Supabase project's URL and publishable key (and a service-role key for server-only admin operations) before running the app.

### Other scripts

```sh
npm run build       # production build
npm run preview     # preview a production build locally
npm run lint         # eslint
npm run format       # prettier --write
```

Database schema changes live in `supabase/migrations/` and are applied with the Supabase CLI (`supabase db push`).

## Author

Built and maintained by **Sashwat Roy**.
