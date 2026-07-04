import { formatPercent } from "@/lib/helpers";
import type { SessionResult } from "@/lib/types";

interface ScoreSummaryProps {
  result: SessionResult;
}

export function ScoreSummary({ result }: ScoreSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-[1.5rem] border border-white/10 bg-[color:var(--color-panel)] p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
          Percentage
        </div>
        <div className="mt-3 text-3xl font-semibold">{formatPercent(result.percentageScore)}</div>
      </div>
      <div className="rounded-[1.5rem] border border-white/10 bg-[color:var(--color-panel)] p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
          Correct
        </div>
        <div className="mt-3 text-3xl font-semibold">
          {result.correctAnswers}/{result.totalQuestions}
        </div>
      </div>
      <div className="rounded-[1.5rem] border border-white/10 bg-[color:var(--color-panel)] p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
          Scaled
        </div>
        <div className="mt-3 text-3xl font-semibold">{result.scaledScore}/1000</div>
      </div>
      <div className="rounded-[1.5rem] border border-white/10 bg-[color:var(--color-panel)] p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
          Result
        </div>
        <div
          className={`mt-3 text-3xl font-semibold ${
            result.passed ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          {result.passed ? "Pass" : "Fail"}
        </div>
      </div>
    </div>
  );
}
