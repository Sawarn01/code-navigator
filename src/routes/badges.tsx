import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Award, Lock, Search, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getBadgeCatalog, getMyEarnedBadges } from "@/lib/badges.functions";
import { useAuth } from "@/hooks/useAuth";

const catalogQuery = queryOptions({
  queryKey: ["badge-catalog"],
  queryFn: () => getBadgeCatalog(),
});

export const Route = createFileRoute("/badges")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  head: () => ({
    meta: [
      { title: "Badges — Space" },
      {
        name: "description",
        content: "Every achievement badge on Space, how to earn it, and how many students have it.",
      },
      { property: "og:title", content: "Badges — Space" },
      {
        property: "og:description",
        content: "Browse all Space achievement badges and their criteria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center text-sm text-muted-foreground">
      Could not load badges. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
      Page not found.
    </div>
  ),
  component: BadgesPage,
});

function BadgesPage() {
  const { data: badges } = useSuspenseQuery(catalogQuery);
  const { isAuthenticated } = useAuth();
  const fetchEarned = useServerFn(getMyEarnedBadges);
  const { data: earnedData } = useQuery({
    queryKey: ["my-earned-badges"],
    queryFn: () => fetchEarned(),
    enabled: isAuthenticated,
  });
  const earned = useMemo(() => earnedData?.earned ?? {}, [earnedData]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "earned" | "locked">("all");

  const totalEarners = badges.reduce((sum, b) => sum + b.earned_count, 0);
  const earnedCount = isAuthenticated ? Object.keys(earned).length : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return badges.filter((b) => {
      if (
        q &&
        !b.name.toLowerCase().includes(q) &&
        !(b.description ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      if (filter === "earned") return Boolean(earned[b.id]);
      if (filter === "locked") return !earned[b.id];
      return true;
    });
  }, [badges, search, filter, earned]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 pb-24 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-indigo-900">Badges</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {badges.length} achievement badges, earned {totalEarners} times across Space.
            {isAuthenticated && ` You have ${earnedCount} of ${badges.length}.`}
          </p>
        </motion.div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {isAuthenticated && (
            <div className="flex gap-2">
              {(["all", "earned", "locked"] as const).map((f) => (
                <motion.button
                  key={f}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition-colors ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "surface-tint text-indigo-700 hover:bg-indigo-100"
                  }`}
                >
                  {f}
                </motion.button>
              ))}
            </div>
          )}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search badges…"
              aria-label="Search badges"
              className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((badge, i) => {
            const isEarned = Boolean(earned[badge.id]);
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.04 }}
                whileHover={{ y: -3 }}
                className={`rounded-2xl border p-5 shadow-[var(--shadow-soft)] ${
                  isEarned ? "border-indigo-200 surface-tint" : "border-border bg-card"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
                      isEarned
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isEarned ? <Award className="size-6" /> : <Lock className="size-5" />}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-base font-bold text-indigo-900">
                      {badge.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {badge.earned_count} student{badge.earned_count === 1 ? "" : "s"} earned this
                    </p>
                  </div>
                </div>
                {badge.description && (
                  <p className="mt-3 text-sm text-muted-foreground">{badge.description}</p>
                )}
                {badge.criteria_description && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                    <Sparkles className="size-3.5" /> {badge.criteria_description}
                  </p>
                )}
                {isAuthenticated && isEarned && (
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                    Earned {new Date(earned[badge.id]!).toLocaleDateString()}
                  </p>
                )}
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              No badges match your search.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
