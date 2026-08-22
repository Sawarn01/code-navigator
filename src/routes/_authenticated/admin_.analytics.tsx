import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { getPlatformAnalytics } from "@/lib/analytics.functions";
import { QuestionAnalyticsPanel } from "@/components/admin/QuestionAnalyticsPanel";

export const Route = createFileRoute("/_authenticated/admin_/analytics")({
  head: () => ({
    meta: [
      { title: "Platform analytics — Space" },
      {
        name: "description",
        content:
          "Admin-only analytics for Space: activity, submissions, difficulty mix, language popularity and signup growth.",
      },
      { property: "og:title", content: "Platform analytics — Space" },
      {
        property: "og:description",
        content: "Admin-only analytics dashboard for the Space coding platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const INDIGO = ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe", "#e0e7ff"];

function StatCard({ label, value, delay }: { label: string; value: number; delay: number }) {
  return (
    <BentoCard className="lg:col-span-3" delay={delay}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.1 }}
        className="mt-2 font-display text-3xl font-bold text-indigo-900"
      >
        {value.toLocaleString()}
      </motion.p>
    </BentoCard>
  );
}

const chartTooltip = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid #e0e7ff",
    fontSize: 12,
    boxShadow: "0 10px 30px -12px rgba(79,70,229,.35)",
  },
};

function AnalyticsPage() {
  const fetchAnalytics = useServerFn(getPlatformAnalytics);
  const { data, isLoading, error } = useQuery({
    queryKey: ["platform-analytics"],
    queryFn: () => fetchAnalytics(),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <h1 className="text-3xl">Platform analytics</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Admin-only overview of activity, content health and growth across Space.
            </p>
          </div>
          <Link
            to="/admin"
            className="rounded-xl border border-input px-3 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
          >
            Back to admin
          </Link>
        </motion.div>

        {error ? (
          <div className="bento-card mt-8">
            <p className="text-sm text-destructive">
              You need the admin role to view platform analytics.
            </p>
          </div>
        ) : isLoading || !data ? (
          <p className="mt-8 text-sm text-muted-foreground">Crunching numbers…</p>
        ) : (
          <>
            <div className="bento-grid mt-8">
              <StatCard label="Total users" value={data.stats.totalUsers} delay={0} />
              <StatCard label="Daily active" value={data.stats.dailyActive} delay={0.04} />
              <StatCard label="Weekly active" value={data.stats.weeklyActive} delay={0.08} />
              <StatCard label="Submissions today" value={data.stats.submissionsToday} delay={0.12} />
              <StatCard label="Submissions this week" value={data.stats.submissionsWeek} delay={0.16} />
              <StatCard label="Total points awarded" value={data.stats.totalPoints} delay={0.2} />
              <StatCard label="Active study groups" value={data.stats.activeGroups} delay={0.24} />
              <StatCard label="Upcoming events" value={data.stats.upcomingEvents} delay={0.28} />
            </div>

            <div className="bento-grid mt-6">
              <BentoCard className="lg:col-span-8">
                <h2 className="font-display text-lg font-semibold text-indigo-900">
                  Submissions over time
                </h2>
                <p className="text-xs text-muted-foreground">Last 30 days · total vs accepted</p>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.submissionsOverTime}>
                      <defs>
                        <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a5b4fc" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#a5b4fc" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" />
                      <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip {...chartTooltip} />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#4f46e5"
                        fill="url(#gTotal)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="accepted"
                        stroke="#818cf8"
                        fill="url(#gAcc)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </BentoCard>

              <BentoCard className="lg:col-span-4" delay={0.05}>
                <h2 className="font-display text-lg font-semibold text-indigo-900">
                  Solved by difficulty
                </h2>
                <p className="text-xs text-muted-foreground">Unique solves, last 30 days</p>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.difficultyDistribution}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                      >
                        {data.difficultyDistribution.map((_, i) => (
                          <Cell key={i} fill={INDIGO[i % INDIGO.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...chartTooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {data.difficultyDistribution.map((d, i) => (
                    <span key={d.name} className="flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: INDIGO[i % INDIGO.length] }}
                      />
                      {d.name} · {d.value}
                    </span>
                  ))}
                </div>
              </BentoCard>

              <BentoCard className="lg:col-span-5" delay={0.1}>
                <h2 className="font-display text-lg font-semibold text-indigo-900">
                  Language popularity
                </h2>
                <p className="text-xs text-muted-foreground">Submissions per language</p>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.languagePopularity} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" horizontal={false} />
                      <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip {...chartTooltip} cursor={{ fill: "#eef2ff" }} />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </BentoCard>

              <BentoCard className="lg:col-span-7" delay={0.15}>
                <h2 className="font-display text-lg font-semibold text-indigo-900">
                  Signup growth
                </h2>
                <p className="text-xs text-muted-foreground">Weekly signups and cumulative members</p>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.signupGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" />
                      <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip {...chartTooltip} />
                      <Line
                        type="monotone"
                        dataKey="cumulative"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="signups"
                        stroke="#a5b4fc"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </BentoCard>

              <BentoCard className="lg:col-span-12" delay={0.2}>
                <QuestionAnalyticsPanel />
              </BentoCard>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
