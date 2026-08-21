import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Crown, Medal, Trophy } from "lucide-react";
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
  { icon: Crown, ring: "ring-amber-300", glow: "shadow-[0_12px_40px_-12px_rgba(245,158,11,0.6)]" },
  { icon: Trophy, ring: "ring-slate-300", glow: "shadow-[0_12px_40px_-14px_rgba(100,116,139,0.5)]" },
  { icon: Medal, ring: "ring-orange-300", glow: "shadow-[0_12px_40px_-14px_rgba(234,88,12,0.5)]" },
];

function initials(name: string | null) {
  return (name ?? "SP")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("all");
  useSuspenseQuery(boardQuery("all"));
  const { data } = useQuery(boardQuery(period));
  const { user } = useAuth();

  const rows = data?.rows ?? [];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const mine = rows.find((r) => r.user_id === user?.id);
  const myVisible = mine ? rows.indexOf(mine) < 13 : true;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-indigo-900">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by points earned on first solves across practice and the CP Zone.
          </p>
        </motion.div>

        <div className="mt-6 flex gap-2">
          {(["all", "month", "week"] as const).map((p) => (
            <motion.button
              key={p}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition-colors ${
                period === p ? "bg-primary text-primary-foreground" : "surface-tint text-indigo-700 hover:bg-indigo-100"
              }`}
            >
              {p === "all" ? "All time" : p === "month" ? "This month" : "This week"}
            </motion.button>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {top3.map((row, i) => {
            const Icon = PODIUM[i]!.icon;
            return (
              <motion.div
                key={row.user_id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, type: "spring", stiffness: 120 }}
                whileHover={{ y: -6 }}
                className={`rounded-2xl border border-border bg-card p-5 text-center ring-2 ${PODIUM[i]!.ring} ${PODIUM[i]!.glow} ${
                  i === 0 ? "sm:-translate-y-3" : ""
                }`}
              >
                <Icon className="mx-auto size-6 text-indigo-700" />
                <div className="mx-auto mt-3 grid size-12 place-items-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground">
                  {initials(row.full_name)}
                </div>
                <p className="mt-3 font-semibold text-indigo-900">{row.full_name ?? "Anonymous"}</p>
                <p className="text-2xl font-bold text-indigo-700">{row.periodPoints}</p>
                <p className="text-xs text-muted-foreground">
                  {row.badge_count} badges · {row.solved_count} solved
                </p>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          <table className="w-full text-left text-sm">
            <thead className="surface-tint text-xs uppercase tracking-wide text-indigo-700">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Points</th>
                <th className="px-4 py-3">Badges</th>
                <th className="px-4 py-3">Solved</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((row, i) => (
                <motion.tr
                  key={row.user_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 15) * 0.02 }}
                  className={`border-t border-border ${row.user_id === user?.id ? "bg-indigo-50" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold text-muted-foreground">{row.displayRank}</td>
                  <td className="px-4 py-3 font-medium text-indigo-900">{row.full_name ?? "Anonymous"}</td>
                  <td className="px-4 py-3 font-bold text-indigo-700">{row.periodPoints}</td>
                  <td className="px-4 py-3">{row.badge_count}</td>
                  <td className="px-4 py-3">{row.solved_count}</td>
                </motion.tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No ranked students yet — be the first to solve a problem.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {mine && !myVisible && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky bottom-4 mt-4 flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm shadow-[var(--shadow-soft)]"
          >
            <span className="font-semibold text-indigo-900">
              #{mine.displayRank} · {mine.full_name ?? "You"}
            </span>
            <span className="font-bold text-indigo-700">{mine.periodPoints} pts</span>
          </motion.div>
        )}
      </main>
    </div>
  );
}
