import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleCheck,
  CircleX,
  Flame,
  Plus,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";
import { useAuth } from "@/hooks/useAuth";
import { getProfile } from "@/lib/profile.functions";
import { getRecommendedQuestion } from "@/lib/topics.functions";
import { getCourses, getMyCourseProgress } from "@/lib/learn.functions";
import { getEvents } from "@/lib/events.functions";
import { listNotifications } from "@/lib/notifications.functions";
import { listMyMentees } from "@/lib/mentorship.functions";
import { getStudentReport, getPlatformAnalytics } from "@/lib/analytics.functions";
import { getPistonHealth } from "@/lib/health.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — Space" },
      {
        name: "description",
        content:
          "Your personalised Space dashboard: streak, recommended next problem, course progress, upcoming events and rank.",
      },
      { property: "og:title", content: "Your dashboard — Space" },
      {
        property: "og:description",
        content: "A role-aware home screen for students, mentors and admins on Space.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Could not load your dashboard. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Page not found.
    </div>
  ),
  component: DashboardPage,
});

function DashboardPage() {
  const { role, user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
            {role === "admin" ? "Admin" : role === "manager" ? "Mentor" : "Student"} dashboard
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-indigo-900">
            Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}
          </h1>
        </motion.div>

        <div className="mt-6">
          {role === "admin" ? (
            <AdminView />
          ) : role === "manager" ? (
            <ManagerView />
          ) : (
            <StudentView />
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <BentoCard>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold text-indigo-900">{value}</p>
        </div>
      </div>
    </BentoCard>
  );
}

function StudentView() {
  const fetchProfile = useServerFn(getProfile);
  const fetchRecommendation = useServerFn(getRecommendedQuestion);
  const fetchProgress = useServerFn(getMyCourseProgress);
  const fetchNotifications = useServerFn(listNotifications);

  const { data: profile } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => fetchProfile({ data: { userId: "me" } }),
  });
  const { data: recommended } = useQuery({
    queryKey: ["recommended-question"],
    queryFn: () => fetchRecommendation(),
  });
  const { data: courses } = useQuery({ queryKey: ["courses"], queryFn: () => getCourses() });
  const { data: progress } = useQuery({
    queryKey: ["my-course-progress"],
    queryFn: () => fetchProgress(),
  });
  const { data: events } = useQuery({ queryKey: ["events"], queryFn: () => getEvents() });
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
  });

  const enrolled = (courses?.courses ?? [])
    .filter((c) => (progress?.byCourse[c.id] ?? 0) > 0)
    .slice(0, 4);
  const upcoming = (events?.events ?? [])
    .filter((e) => new Date(e.start_time).getTime() > Date.now())
    .slice(0, 4);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Stat label="Current streak" value={`${profile?.streak ?? 0}d`} icon={<Flame className="size-5" />} />
      <Stat label="Points" value={profile?.profile?.points ?? 0} icon={<Sparkles className="size-5" />} />
      <Stat
        label="Rank"
        value={profile?.rank ? `#${profile.rank}` : "—"}
        icon={<Trophy className="size-5" />}
      />
      <Stat
        label="Badges"
        value={(profile?.badges ?? []).filter((b) => b.earned).length}
        icon={<CircleCheck className="size-5" />}
      />

      <BentoCard className="md:col-span-2 lg:col-span-3">
        <h2 className="text-lg font-semibold text-indigo-900">Activity</h2>
        <p className="text-xs text-muted-foreground">Accepted submissions over the last 26 weeks.</p>
        <div className="mt-3 overflow-x-auto">
          <ActivityHeatmap days={profile?.activity ?? []} />
        </div>
      </BentoCard>

      <BentoCard>
        <h2 className="text-lg font-semibold text-indigo-900">Next problem</h2>
        {recommended ? (
          <>
            <p className="mt-2 font-medium text-indigo-800">{recommended.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{recommended.reason}</p>
            <Link
              to="/practice"
              search={{ lang: "all", q: recommended.title }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              Solve it <ArrowRight className="size-4" />
            </Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Solve a few problems and we&apos;ll target your weakest topic.
          </p>
        )}
      </BentoCard>

      <BentoCard className="md:col-span-2">
        <h2 className="text-lg font-semibold text-indigo-900">Your courses</h2>
        <div className="mt-3 space-y-3">
          {enrolled.map((c) => {
            const done = progress?.byCourse[c.id] ?? 0;
            const pct = c.lesson_count ? Math.round((100 * done) / c.lesson_count) : 0;
            return (
              <Link
                key={c.id}
                to="/learn/$courseId"
                params={{ courseId: c.id }}
                className="block rounded-xl border border-border p-3 hover:border-indigo-300"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-indigo-900">{c.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {done}/{c.lesson_count}
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-indigo-50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    className="h-1.5 rounded-full bg-indigo-500"
                  />
                </div>
              </Link>
            );
          })}
          {enrolled.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No courses started yet.{" "}
              <Link to="/learn" className="font-semibold text-indigo-600">
                Browse the catalog
              </Link>
              .
            </p>
          )}
        </div>
      </BentoCard>

      <BentoCard>
        <h2 className="text-lg font-semibold text-indigo-900">Upcoming events</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {upcoming.map((e) => (
            <li key={e.id} className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-indigo-500" />
              <div>
                <p className="font-medium text-indigo-900">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.start_time).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
          {upcoming.length === 0 && (
            <li className="text-sm text-muted-foreground">Nothing scheduled right now.</li>
          )}
        </ul>
      </BentoCard>

      <BentoCard>
        <h2 className="text-lg font-semibold text-indigo-900">Recent notifications</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(notifications?.notifications ?? []).slice(0, 5).map((n) => (
            <li key={n.id} className="rounded-xl bg-indigo-50/60 px-3 py-2">
              <p className="font-medium text-indigo-900">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
            </li>
          ))}
          {(notifications?.notifications ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">You&apos;re all caught up.</li>
          )}
        </ul>
      </BentoCard>
    </div>
  );
}

function ManagerView() {
  const fetchMentees = useServerFn(listMyMentees);
  const fetchReport = useServerFn(getStudentReport);

  const { data: mentees } = useQuery({ queryKey: ["my-mentees"], queryFn: () => fetchMentees() });
  const { data: report } = useQuery({
    queryKey: ["student-report"],
    queryFn: () => fetchReport(),
  });

  const list = mentees?.mentees ?? [];
  const avg = (nums: number[]) =>
    nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;

  const cohort = [
    {
      metric: "Points",
      cohort: avg(list.map((m) => m.points)),
      platform: report?.platform.avgPoints ?? 0,
    },
    {
      metric: "Streak",
      cohort: avg(list.map((m) => m.streak)),
      platform: report?.platform.avgStreak ?? 0,
    },
    {
      metric: "Solved",
      cohort: avg(list.map((m) => m.solved)),
      platform: report?.platform.avgSolved ?? 0,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Stat label="Mentees" value={list.length} icon={<Users className="size-5" />} />
      <Stat label="Avg points" value={cohort[0]!.cohort} icon={<Sparkles className="size-5" />} />
      <Stat label="Avg streak" value={`${cohort[1]!.cohort}d`} icon={<Flame className="size-5" />} />
      <Stat label="Avg solved" value={cohort[2]!.cohort} icon={<CircleCheck className="size-5" />} />

      <BentoCard className="md:col-span-2 lg:col-span-2">
        <h2 className="text-lg font-semibold text-indigo-900">Cohort vs platform</h2>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cohort}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" />
              <XAxis dataKey="metric" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="cohort" name="Your mentees" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              <Bar dataKey="platform" name="Platform" fill="#c7d2fe" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </BentoCard>

      <BentoCard className="md:col-span-2">
        <h2 className="text-lg font-semibold text-indigo-900">Mentees</h2>
        <ul className="mt-3 space-y-2">
          {list.slice(0, 6).map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
            >
              <span className="font-medium text-indigo-900">{m.full_name ?? "Student"}</span>
              <span className="text-xs text-muted-foreground">
                {m.points} pts · {m.streak}d streak · {m.solved} solved
              </span>
            </li>
          ))}
          {list.length === 0 && (
            <li className="text-sm text-muted-foreground">No mentees assigned yet.</li>
          )}
        </ul>
        <Link
          to="/mentees"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600"
        >
          Open mentee workspace <ArrowRight className="size-4" />
        </Link>
      </BentoCard>

      <BentoCard className="md:col-span-2 lg:col-span-4">
        <h2 className="text-lg font-semibold text-indigo-900">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <QuickLink to="/admin/questions" icon={<Plus className="size-4" />} label="Question builder" />
          <QuickLink to="/admin" icon={<BookOpen className="size-4" />} label="Course builder" />
          <QuickLink to="/reporting" icon={<Activity className="size-4" />} label="Student reporting" />
          <QuickLink to="/groups" icon={<Users className="size-4" />} label="Study groups" />
        </div>
      </BentoCard>
    </div>
  );
}

function AdminView() {
  const fetchAnalytics = useServerFn(getPlatformAnalytics);
  const { data } = useQuery({ queryKey: ["platform-analytics"], queryFn: () => fetchAnalytics() });
  const { data: piston } = useQuery({
    queryKey: ["piston-health"],
    queryFn: () => getPistonHealth(),
    refetchInterval: 60000,
  });

  const s = data?.stats;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Stat label="Total users" value={s?.totalUsers ?? 0} icon={<Users className="size-5" />} />
      <Stat label="Active today" value={s?.dailyActive ?? 0} icon={<Activity className="size-5" />} />
      <Stat
        label="Submissions today"
        value={s?.submissionsToday ?? 0}
        icon={<Sparkles className="size-5" />}
      />
      <Stat
        label="Upcoming events"
        value={s?.upcomingEvents ?? 0}
        icon={<CalendarDays className="size-5" />}
      />

      <BentoCard className="md:col-span-2">
        <h2 className="text-lg font-semibold text-indigo-900">System status</h2>
        <div
          className={`mt-3 flex items-start gap-3 rounded-xl border px-3 py-3 ${
            piston?.reachable
              ? "border-emerald-200 bg-emerald-50"
              : "border-rose-200 bg-rose-50"
          }`}
        >
          {piston?.reachable ? (
            <CircleCheck className="mt-0.5 size-5 text-emerald-600" />
          ) : (
            <CircleX className="mt-0.5 size-5 text-rose-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-indigo-900">
              Piston execution service {piston?.reachable ? "online" : "unreachable"}
            </p>
            <p className="text-xs text-muted-foreground">
              {piston ? piston.message : "Pinging…"}
              {piston?.reachable ? ` · ${piston.runtimes} runtimes` : ""}
            </p>
          </div>
        </div>
      </BentoCard>

      <BentoCard className="md:col-span-2">
        <h2 className="text-lg font-semibold text-indigo-900">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <QuickLink to="/admin/questions" icon={<Plus className="size-4" />} label="Add question" />
          <QuickLink to="/admin" icon={<BookOpen className="size-4" />} label="Add course" />
          <QuickLink to="/admin" icon={<Users className="size-4" />} label="Manage users & roles" />
          <QuickLink
            to="/admin/analytics"
            icon={<Activity className="size-4" />}
            label="Platform analytics"
          />
        </div>
      </BentoCard>

      <BentoCard className="md:col-span-2 lg:col-span-4">
        <h2 className="text-lg font-semibold text-indigo-900">Submissions over time</h2>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.submissionsOverTime ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="total" name="Submissions" fill="#c7d2fe" radius={[6, 6, 0, 0]} />
              <Bar dataKey="accepted" name="Accepted" fill="#4f46e5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </BentoCard>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  label,
}: {
  to: "/admin" | "/admin/questions" | "/admin/analytics" | "/reporting" | "/groups";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
    >
      {icon}
      {label}
    </Link>
  );
}
