import { Bell, Award, MessageSquare, CalendarClock, Flame, NotebookPen, Users } from "lucide-react";
import type { NotificationType } from "@/lib/notifications.functions";

export const notificationTypeIcon: Record<NotificationType, typeof Bell> = {
  badge_earned: Award,
  forum_reply: MessageSquare,
  event_reminder: CalendarClock,
  streak_risk: Flame,
  mentor_note: NotebookPen,
  group_invite: Users,
};

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
