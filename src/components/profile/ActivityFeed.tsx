import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, CalendarCheck, GraduationCap, Trophy } from "lucide-react";
import { getMyActivityFeed, type ActivityItem } from "@/lib/activity.functions";

const ICONS: Record<ActivityItem["type"], typeof Trophy> = {
  submission: Trophy,
  badge: Award,
  certificate: GraduationCap,
  event_registration: CalendarCheck,
};

const VERBS: Record<ActivityItem["type"], string> = {
  submission: "Solved",
  badge: "Earned badge",
  certificate: "Completed course",
  event_registration: "Registered for",
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diff / 36e5);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const fetchFeed = useServerFn(getMyActivityFeed);
  const { data: items } = useQuery({
    queryKey: ["my-activity-feed", limit],
    queryFn: () => fetchFeed({ data: { limit } }),
  });

  if (!items?.length) {
    return <p className="text-sm text-muted-foreground">No activity yet — go solve something!</p>;
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const Icon = ICONS[item.type];
        return (
          <li key={item.id} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg surface-tint text-indigo-600">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-indigo-900">
                <span className="font-semibold">{VERBS[item.type]}</span> {item.title}
                {item.meta ? ` · ${item.meta}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">{relativeTime(item.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
