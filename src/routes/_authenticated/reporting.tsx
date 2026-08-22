import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import {
  getStudentReport,
  getStudentDetail,
  type StudentRow,
} from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/reporting")({
  head: () => ({
    meta: [
      { title: "Student reporting — Space" },
      {
        name: "description",
        content:
          "Filter, sort and export student progress: points, streaks, badges and pass rates for your mentees.",
      },
      { property: "og:title", content: "Student reporting — Space" },
      {
        property: "og:description",
        content: "Mentor and admin reporting on student progress across Space.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportingPage,
});

const INDIGO = ["#4f46e5", "#818cf8", "#c7d2fe", "#a5b4fc", "#e0e7ff"];
const tooltipStyle = {
  contentStyle: { borderRadius: 12, border: "1px solid #e0e7ff", fontSize: 12 },
};

type SortKey = "points" | "streak" | "solved" | "badges" | "last_active";

function activityLevel(row: StudentRow): "high" | "medium" | "low" {
  if (!row.last_active) return "low";
  const days = (Date.now() - new Date(`${row.last_active}T00:00:00Z`).getTime()) / 86400000;
  if (days <= 2 && row.solved > 0) return "high";
  if (days <= 10) return "medium";
  return "low";
}

function ReportingPage() {
  const fetchReport = useServerFn(getStudentReport);
  const fetchDetail = useServerFn(getStudentDetail);

  const [group, setGroup] = useState("all");
  const [mentor, setMentor] = useState("all");
  const [activity, setActivity] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["student-report"],
    queryFn: () => fetchReport(),
    retry: false,
  });

  const { data: detail, isFetching: detailLoading } = useQuery({
    queryKey: ["student-detail", openId],
    queryFn: () => fetchDetail({ data: { studentId: openId! } }),
    enabled: !!openId,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = (data?.rows ?? []).filter(
      (r) =>
        (group === "all" || r.groups.includes(group)) &&
        (mentor === "all" || r.mentor === mentor) &&
        (activity === "all" || activityLevel(r) === activity) &&
        (!q || (r.full_name ?? "").toLowerCase().includes(q)),
    );
    return filtered.sort((a, b) => {
      if (sortKey === "last_active") return (b.last_active ?? "").localeCompare(a.last_active ?? "");
      return (b[sortKey] as number) - (a[sortKey] as number);
    });
  }, [data, group, mentor, activity, search, sortKey]);

  const cohort = useMemo(() => {
    const n = rows.length || 1;
    const avg = (f: (r: StudentRow) => number) => rows.reduce((s, r) => s + f(r), 0) / n;
    const p = data?.platform ?? { avgPoints: 0, avgStreak: 0, avgSolved: 0 };
    return [
      { metric: "Avg points", Cohort: +avg((r) => r.points).toFixed(1), Platform: +p.avgPoints.toFixed(1) },
      { metric: "Avg streak", Cohort: +avg((r) => r.streak).toFixed(1), Platform: +p.avgStreak.toFixed(1) },
      { metric: "Avg solved", Cohort: +avg((r) => r.solved).toFixed(1), Platform: +p.avgSolved.toFixed(1) },
    ];
  }, [rows, data]);

  function exportCsv() {
    const header = [
      "Name",
      "Points",
      "Streak",
      "Last active",
      "Badges",
      "Solved",
      "Attempts",
      "Pass rate %",
      "Groups",
      "Mentor",
    ];
    const lines = rows.map((r) =>
      [
        r.full_name ?? "Unnamed",
        r.points,
        r.streak,
        r.last_active ?? "",
        r.badges,
        r.solved,
        r.attempts,
        r.passRate.toFixed(1),
        r.groups.join(" | "),
        r.mentor ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `space-students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl">Student reporting</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data?.scope === "manager"
              ? "Scoped to your assigned mentees — enforced server-side."
              : "Platform-wide view of every student."}
          </p>
        </motion.div>

        {error ? (
          <div className="bento-card mt-8">
            <p className="text-sm text-destructive">
              You need the manager or admin role to view reporting.
            </p>
          </div>
        ) : isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading students…</p>
        ) : (
          <div className="bento-grid mt-8">
            <BentoCard className="lg:col-span-12">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students…"
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-ring/30"
                />
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-indigo-700"
                >
                  <option value="all">All groups</option>
                  {(data?.groups ?? []).map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <select
                  value={mentor}
                  onChange={(e) => setMentor(e.target.value)}
                  className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-indigo-700"
                >
                  <option value="all">All mentors</option>
                  {(data?.mentors ?? []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-indigo-700"
                >
                  <option value="all">Any activity</option>
                  <option value="high">High activity</option>
                  <option value="medium">Medium activity</option>
                  <option value="low">Low activity</option>
                </select>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-indigo-700"
                >
                  <option value="points">Sort by points</option>
                  <option value="streak">Sort by streak</option>
                  <option value="solved">Sort by solved</option>
                  <option value="badges">Sort by badges</option>
                  <option value="last_active">Sort by last active</option>
                </select>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={exportCsv}
                  className="ml-auto rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
                >
                  Export CSV ({rows.length})
                </motion.button>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-indigo-50/80">
                    <tr className="text-xs uppercase tracking-wide text-indigo-700">
                      <th className="px-3 py-2.5 font-semibold">Student</th>
                      <th className="px-3 py-2.5 font-semibold">Points</th>
                      <th className="px-3 py-2.5 font-semibold">Streak</th>
                      <th className="px-3 py-2.5 font-semibold">Last active</th>
                      <th className="px-3 py-2.5 font-semibold">Badges</th>
                      <th className="px-3 py-2.5 font-semibold">Solved</th>
                      <th className="px-3 py-2.5 font-semibold">Pass rate</th>
                      <th className="px-3 py-2.5 font-semibold">Mentor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <motion.tr
                        key={r.id}
                        layout
                        onClick={() => setOpenId(r.id)}
                        className="cursor-pointer transition-colors hover:bg-indigo-50/50"
                      >
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-indigo-900">
                            {r.full_name ?? "Unnamed"}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {r.groups.length ? r.groups.join(", ") : "No group"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.points}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.streak}d</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.last_active ?? "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.badges}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.solved}</td>
                        <td className="px-3 py-2.5 font-semibold text-indigo-700">
                          {r.passRate.toFixed(0)}%
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.mentor ?? "—"}</td>
                      </motion.tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-6 text-center text-sm text-muted-foreground"
                        >
                          No students match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </BentoCard>

            <BentoCard className="lg:col-span-12" delay={0.05}>
              <h2 className="font-display text-lg font-semibold text-indigo-900">
                Cohort vs platform
              </h2>
              <p className="text-xs text-muted-foreground">
                Current filtered cohort compared with platform-wide averages.
              </p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cohort}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" />
                    <XAxis dataKey="metric" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipStyle} cursor={{ fill: "#eef2ff" }} />
                    <Bar dataKey="Cohort" fill="#4f46e5" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Platform" fill="#c7d2fe" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </BentoCard>
          </div>
        )}
      </main>

      <AnimatePresence>
        {openId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenId(null)}
              className="fixed inset-0 z-50 bg-indigo-950/25 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 240 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-indigo-900">
                    {detail?.full_name ?? "Student"}
                  </h2>
                  <p className="text-xs text-muted-foreground">Solve history & breakdown</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="rounded-lg border border-input px-2.5 py-1 text-sm text-muted-foreground hover:bg-accent"
                >
                  Close
                </button>
              </div>

              {detailLoading || !detail ? (
                <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl surface-tint p-3">
                      <p className="text-xs text-muted-foreground">Accepted</p>
                      <p className="font-display text-2xl font-bold text-indigo-900">
                        {detail.passFail.accepted}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-xs text-muted-foreground">Failed</p>
                      <p className="font-display text-2xl font-bold text-indigo-900">
                        {detail.passFail.failed}
                      </p>
                    </div>
                  </div>

                  {detail.languages.length > 0 && (
                    <div className="mt-6 h-48">
                      <p className="mb-1 text-sm font-semibold text-indigo-900">
                        Language breakdown
                      </p>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={detail.languages}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={40}
                            outerRadius={68}
                            paddingAngle={3}
                          >
                            {detail.languages.map((_, i) => (
                              <Cell key={i} fill={INDIGO[i % INDIGO.length]} />
                            ))}
                          </Pie>
                          <Tooltip {...tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <p className="mt-6 text-sm font-semibold text-indigo-900">Solve timeline</p>
                  <ul className="mt-3 space-y-2">
                    {detail.timeline.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-start gap-3 rounded-xl border border-border p-3"
                      >
                        <span
                          className={`mt-1 size-2 shrink-0 rounded-full ${
                            t.status === "accepted" ? "bg-indigo-500" : "bg-indigo-200"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-indigo-900">
                            {t.title ?? "Untitled problem"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.status ?? "pending"} · {t.difficulty ?? "—"} · {t.language ?? "—"} ·{" "}
                            {new Date(t.submitted_at).toLocaleDateString()}
                          </p>
                        </div>
                      </li>
                    ))}
                    {detail.timeline.length === 0 && (
                      <li className="text-sm text-muted-foreground">No submissions yet.</li>
                    )}
                  </ul>
                </>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
