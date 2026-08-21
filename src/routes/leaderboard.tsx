import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { animate, motion } from "framer-motion";
import { Crown, Flame, Medal, Search, Sparkles, Trophy, Users } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getLeaderboard } from "@/lib/practice.functions";
import { useAuth } from "@/hooks/useAuth";

type Period = "all" | "month" | "week";

const boardQuery = (period: Period) =>
  queryOptions({
    queryKey: ["leaderboard", period],
    queryFn: () => getLeaderboard({ data: { period } }),
  });

export const Route = createFileRoute("/leaderboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery("all")),
  head: () => ({
    meta: [
      { title: "Leaderboard — Space" },
      {
        name: "description",
        content:
          "See who is leading Space this week, this month and all time — ranked by points earned on practice and contest problems.",
      },
      { property: "og:title", content: "Leaderboard — Space" },
      { property: "og:description", content: "Global points ranking for Space students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center text-sm text-muted-foreground">
      Could not load the leaderboard. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Page not found.
    </div>
  ),
  component: LeaderboardPage,
});

const PODIUM = [
  {
    icon: Crown,
    ring: "ring-amber-300",
    glow: "shadow-[0_16px_44px_-14px_rgba(245,158,11,0.6)]",
    chip: "bg-amber-100 text-amber-800",
    avatar: "bg-gradient-to-br from-amber-400 to-amber-600",
    label: "Champion",
  },
  {
    icon: Trophy,
    ring: "ring-slate-300",
    glow: "shadow-[0_16px_44px_-16px_rgba(100,116,139,0.5)]",
    chip: "bg-slate-100 text-slate-700",
    avatar: "bg-gradient-to-br from-slate-400 to-slate-600",
    label: "Runner-up",
  },
  {
    icon: Medal,
    ring: "ring-orange-300",
    glow: "shadow-[0_16px_44px_-16px_rgba(234,88,12,0.5)]",
    chip: "bg-orange-100 text-orange-800",
    avatar: "bg-gradient-to-br from-orange-400 to-orange-600",
    label: "Third place",
  },
];

function initials(name: string | null) {
  return (name ?? "SP")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => {
        node.textContent = Math.round(v).toLocaleString("en-US");
      },
    });
    return () => controls.stop();
  }, [value]);
  return <span ref={ref}>0</span>;
}

function Avatar({
  name,
  url,
  className = "",
}: {
  name: string | null;
  url: string | null;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? "Student avatar"}
        loading="lazy"
        className={`rounded-2xl object-cover ${className}`}
      />
    );
  }
  return (
    <span
      className={`grid place-items-center rounded-2xl bg-primary font-bold text-primary-foreground ${className}`}
    >
      {initials(name)}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-colors hover:border-indigo-200"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4 text-indigo-600" />
        {label}
      </div>
      <p className="mt-1 font-display text-2xl font-bold text-indigo-900 tabular-nums">
        <Counter value={value} />
      </p>
    </motion.div>
  );
}

function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("all");
  const [search, setSearch] = useState("");
  useSuspenseQuery(boardQuery("all"));
  const { data, isFetching } = useQuery(boardQuery(period));
  const { user } = useAuth();

  const rows = data?.rows ?? [];
  const top3 = rows.slice(0, 3);
  const mine = rows.find((r) => r.user_id === user?.id);
  const topPoints = Math.max(1, rows[0]?.periodPoints ?? 1);

  const totals = useMemo(
    () => ({
      students: rows.length,
      points: rows.reduce((s, r) => s + (r.periodPoints ?? 0), 0),
      solved: rows.reduce((s, r) => s + (r.solved_count ?? 0), 0),
    }),
    [rows],
  );

  const q = search.trim().toLowerCase();
  const listRows = useMemo(
    () => (q ? rows.filter((r) => (r.full_name ?? "").toLowerCase().includes(q)) : rows.slice(3)),
    [rows, q],
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 pb-24 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-indigo-900">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by points earned on first solves across practice and the CP Zone.
          </p>
        </motion.div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard icon={Users} label="Ranked students" value={totals.students} />
          <StatCard icon={Sparkles} label="Points earned" value={totals.points} />
          <StatCard icon={Flame} label="Problems solved" value={totals.solved} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {(["all", "month", "week"] as const).map((p) => (
              <motion.button
                key={p}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition-colors ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "surface-tint text-indigo-700 hover:bg-indigo-100"
                }`}
              >
                {p === "all" ? "All time" : p === "month" ? "This month" : "This week"}
              </motion.button>
            ))}
          </div>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students…"
              aria-label="Search students"
              className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-indigo-400"
            />
          </div>
        </div>

        {!q && (
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {top3.map((row, i) => {
              const meta = PODIUM[i]!;
              const Icon = meta.icon;
              return (
                <motion.div
                  key={row.user_id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, type: "spring", stiffness: 120 }}
                  whileHover={{ y: -6 }}
                  className={`relative rounded-2xl border border-border bg-card p-5 text-center ring-2 ${meta.ring} ${meta.glow} ${
                    i === 0 ? "sm:-translate-y-3" : ""
                  }`}
                >
                  {row.user_id === user?.id && (
                    <span className="absolute right-3 top-3 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      You
                    </span>
                  )}
                  <Icon className="mx-auto size-6 text-indigo-700" />
                  <span
                    className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.chip}`}
                  >
                    {meta.label}
                  </span>
                  <Avatar
                    name={row.full_name}
                    url={row.avatar_url}
                    className={`mx-auto mt-3 size-14 text-sm ${row.avatar_url ? "" : meta.avatar}`}
                  />
                  <Link
                    to="/profile/$userId"
                    params={{ userId: row.user_id! }}
                    className="mt-3 block font-semibold text-indigo-900 hover:text-indigo-600"
                  >
                    {row.full_name ?? "Anonymous"}
                  </Link>
                  <p className="text-2xl font-bold text-indigo-700 tabular-nums">
                    <Counter value={row.periodPoints ?? 0} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.badge_count} badges · {row.solved_count} solved
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}

        <div
          className={`mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)] transition-opacity ${
            isFetching ? "opacity-60" : "opacity-100"
          }`}
        >
          <table className="w-full text-left text-sm">
            <thead className="surface-tint text-xs uppercase tracking-wide text-indigo-700">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Points</th>
                <th className="hidden px-4 py-3 sm:table-cell">Badges</th>
                <th className="hidden px-4 py-3 sm:table-cell">Solved</th>
              </tr>
            </thead>
            <tbody>
              {listRows.map((row, i) => (
                <motion.tr
                  key={row.user_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 15) * 0.02 }}
                  className={`border-t border-border transition-colors hover:bg-indigo-50/60 ${
                    row.user_id === user?.id ? "bg-indigo-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-semibold text-muted-foreground tabular-nums">
                    {row.displayRank}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to="/profile/$userId"
                      params={{ userId: row.user_id! }}
                      className="flex items-center gap-3 font-medium text-indigo-900 hover:text-indigo-600"
                    >
                      <Avatar name={row.full_name} url={row.avatar_url} className="size-8 text-[11px]" />
                      <span className="truncate">{row.full_name ?? "Anonymous"}</span>
                      {row.user_id === user?.id && (
                        <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          You
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-indigo-700 tabular-nums">{row.periodPoints}</span>
                    <span className="mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-indigo-100">
                      <motion.span
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.max(4, ((row.periodPoints ?? 0) / topPoints) * 100)}%`,
                        }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="block h-full rounded-full bg-primary"
                      />
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{row.badge_count}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">{row.solved_count}</td>
                </motion.tr>
              ))}
              {listRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {q
                      ? `No students match “${search.trim()}”.`
                      : "No ranked students yet — be the first to solve a problem."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {mine && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky bottom-4 mt-4 flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm shadow-[var(--shadow-soft)]"
          >
            <Avatar name={mine.full_name} url={mine.avatar_url} className="size-8 text-[11px]" />
            <span className="font-semibold text-indigo-900">
              #{mine.displayRank} · {mine.full_name ?? "You"}
            </span>
            <span className="ml-auto font-bold text-indigo-700 tabular-nums">
              {mine.periodPoints} pts
            </span>
          </motion.div>
        )}
      </main>
    </div>
  );
}
