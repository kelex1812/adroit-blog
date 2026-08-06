/**
 * ProgressIndicator — reusable progress bar with label.
 *
 * Uses existing design tokens: red fill on gray track, mono counter.
 */
interface ProgressIndicatorProps {
  current: number;
  total: number;
  /** Label text to display (e.g. "Lesson 3 of 10"). */
  label?: string;
  /** Show percentage. */
  showPercent?: boolean;
}

export default function ProgressIndicator({
  current,
  total,
  label,
  showPercent = false,
}: ProgressIndicatorProps) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[11px] font-semibold text-gray-500">
          {label || `Progress`}
        </span>
        {showPercent && (
          <span className="font-mono text-[11px] font-bold text-navy tabular-nums">
            {pct}%
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-gray-200">
        <div
          className="h-full rounded-full bg-red transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
