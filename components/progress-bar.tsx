interface ProgressBarProps {
  value: number;
  total: number;
  label?: string;
}

export function ProgressBar({ value, total, label }: ProgressBarProps) {
  const percentage = total === 0 ? 0 : (value / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
        <span>{label ?? "Progress"}</span>
        <span>
          {value}/{total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-[color:var(--color-accent)] transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
