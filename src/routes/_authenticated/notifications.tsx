import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BentoCard } from "@/components/BentoCard";
import { listNotificationsPage, markNotificationsRead } from "@/lib/notifications.functions";
import { notificationTypeIcon, relativeTime } from "@/lib/notification-display";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Space" },
      { name: "description", content: "Your full notification history on Space." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const fetchPage = useServerFn(listNotificationsPage);
  const markRead = useServerFn(markNotificationsRead);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["notifications-page"],
    queryFn: ({ pageParam }) => fetchPage({ data: { cursor: pageParam } }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const markAllMutation = useMutation({
    mutationFn: () => markRead({ data: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-page"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <h1 className="font-display text-3xl font-bold text-indigo-900">Notifications</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything Space has told you about, in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-input px-3.5 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-accent disabled:opacity-60"
              >
                <CheckCheck className="size-4" /> Mark all read
              </motion.button>
            )}
            <Link
              to="/settings"
              className="rounded-xl border border-input px-3.5 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-accent"
            >
              Preferences
            </Link>
          </div>
        </motion.div>

        <BentoCard className="mt-8" delay={0.05}>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing here yet. Solve a problem to get things moving.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = notificationTypeIcon[n.type] ?? Bell;
                const inner = (
                  <div className="flex gap-3 px-1 py-4 transition-colors hover:bg-accent/60">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg surface-tint text-indigo-700">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-indigo-900">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                );
                return <li key={n.id}>{n.link ? <a href={n.link}>{inner}</a> : inner}</li>;
              })}
            </ul>
          )}

          {hasNextPage && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-xl border border-input px-4 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-accent disabled:opacity-60"
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </BentoCard>
      </main>
    </div>
  );
}
