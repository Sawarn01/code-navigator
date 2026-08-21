import { CalendarDays, Globe, MapPin, Moon, Sun, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const EVENT_META: Record<
  string,
  { label: string; icon: LucideIcon; chip: string; dot: string }
> = {
  "mini-hackathon": {
    label: "Mini-Hackathon",
    icon: Zap,
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-400",
  },
  "saturday-day": {
    label: "Saturday Day",
    icon: Sun,
    chip: "bg-indigo-100 text-indigo-800 border-indigo-300",
    dot: "bg-indigo-500",
  },
  "saturday-night": {
    label: "Saturday Night",
    icon: Moon,
    chip: "bg-indigo-900/90 text-indigo-50 border-indigo-900",
    dot: "bg-indigo-900",
  },
  virtual: {
    label: "Virtual",
    icon: Globe,
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-400",
  },
  offline: {
    label: "Offline",
    icon: MapPin,
    chip: "bg-white text-indigo-700 border-indigo-200",
    dot: "bg-indigo-300",
  },
};

export function eventMeta(type: string) {
  return (
    EVENT_META[type] ?? {
      label: type,
      icon: CalendarDays,
      chip: "bg-muted text-muted-foreground border-border",
      dot: "bg-muted-foreground",
    }
  );
}

export function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
