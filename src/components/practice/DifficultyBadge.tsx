const STYLES: Record<string, string> = {
  easy: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  hard: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function DifficultyBadge({
  difficulty,
  points,
}: {
  difficulty: string;
  points?: number | undefined;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ${
        STYLES[difficulty] ?? "bg-muted text-muted-foreground ring-border"
      }`}
    >
      {difficulty}
      {points !== undefined && <span className="opacity-70">· {points} pts</span>}
    </span>
  );
}
