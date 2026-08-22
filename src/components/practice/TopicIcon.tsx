import {
  ArrowDownWideNarrow,
  BarChart3,
  Binary,
  Database,
  GanttChart,
  GitBranch,
  Hash,
  Layers,
  Layers3,
  MoveHorizontal,
  RectangleHorizontal,
  Repeat,
  Rows3,
  Search,
  Share2,
  Sigma,
  Sparkles,
  Type,
  Zap,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ArrowDownWideNarrow,
  BarChart3,
  Binary,
  Database,
  GanttChart,
  GitBranch,
  Hash,
  Layers,
  Layers3,
  MoveHorizontal,
  RectangleHorizontal,
  Repeat,
  Rows3,
  Search,
  Share2,
  Sigma,
  Sparkles,
  Type,
  Zap,
};

export function TopicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} />;
}
