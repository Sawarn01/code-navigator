import { motion } from "framer-motion";

export type ActivityDay = { date: string; count: number };

const LEVELS = [
  "bg-indigo-50",
  "bg-indigo-200",
  "bg-indigo-400",
  "bg-indigo-600",
  "bg-indigo-800",
];

function level(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/** GitHub-style contribution grid for the last 26 weeks (UTC days). */
export function ActivityHeatmap({ days }: { days: ActivityDay[] }) {
  const byDate = new Map(days.map((d) => [d.date, d.count]));
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  // Align the last column to Saturday so rows read Sun..Sat.
  const endAligned = new Date(end);
  endAligned.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  const weeks: { date: string; count: number; future: boolean }[][] = [];
  for (let w = 25; w >= 0; w--) {
    const col: { date: string; count: number; future: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(endAligned);
      cell.setUTCDate(endAligned.getUTCDate() - w * 7 - (6 - d));
      const iso = cell.toISOString().slice(0, 10);
      col.push({ date: iso, count: byDate.get(iso) ?? 0, future: cell > end });
    }
    weeks.push(col);
  }

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((col, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {col.map((cell) => (
              <motion.div
                key={cell.date}
                initial={{ opacity: 0, scale: 0.6 }}
                whileInView={{ opacity: cell.future ? 0.25 : 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.2, delay: Math.min(wi, 26) * 0.008 }}
                whileHover={{ scale: 1.35 }}
                title={`${cell.date}: ${cell.count} accepted solution${cell.count === 1 ? "" : "s"}`}
                className={`size-[11px] rounded-[3px] ${LEVELS[level(cell.count)]}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>Less</span>
        {LEVELS.map((c) => (
          <span key={c} className={`size-[11px] rounded-[3px] ${c}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
