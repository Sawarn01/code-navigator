import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { Bell, Award, MessageSquare, CalendarClock, Flame, NotebookPen, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  listNotifications,
  markNotificationsRead,
  type NotificationType,
} from "@/lib/notifications.functions";

const typeIcon: Record<NotificationType, typeof Bell> = {
  badge_earned: Award,
  forum_reply: MessageSquare,
  event_reminder: CalendarClock,
  streak_risk: Flame,
  mentor_note: NotebookPen,
  group_invite: Users,
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationBell() {
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const controls = useAnimationControls();

  const fetchNotifications = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  const markAll = useMutation({
    mutationFn: () => markRead({ data: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Live updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void controls.start({
            rotate: [0, -14, 12, -8, 6, 0],
            scale: [1, 1.15, 1],
            transition: { duration: 0.7, ease: "easeInOut" },
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, controls]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!isAuthenticated) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) markAll.mutate();
  }

  return (
    <div ref={containerRef} className="relative">
      <motion.button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        animate={controls}
        className="relative grid size-10 place-items-center rounded-xl border border-input text-indigo-700 transition-colors hover:bg-accent"
      >
        <Bell className="size-[18px]" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-[var(--shadow-glow)]"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[92vw] overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-indigo-900">Notifications</p>
              <Link
                to="/settings"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-indigo-700 hover:underline"
              >
                Preferences
              </Link>
            </div>
            <div className="max-h-[22rem] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nothing here yet. Solve a problem to get things moving.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  <AnimatePresence initial={false}>
                    {items.map((n, i) => {
                      const Icon = typeIcon[n.type] ?? Bell;
                      const inner = (
                        <div className="flex gap-3 px-4 py-3 transition-colors hover:bg-accent/60">
                          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg surface-tint text-indigo-700">
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-indigo-900">
                              {n.title}
                            </p>
                            {n.body && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {n.body}
                              </p>
                            )}
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                              {relativeTime(n.created_at)}
                            </p>
                          </div>
                          {!n.is_read && (
                            <span className="ml-auto mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                      );
                      return (
                        <motion.li
                          key={n.id}
                          layout
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -16 }}
                          transition={{ duration: 0.22, delay: Math.min(i, 6) * 0.03 }}
                        >
                          {n.link ? (
                            <a href={n.link} onClick={() => setOpen(false)}>
                              {inner}
                            </a>
                          ) : (
                            inner
                          )}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
