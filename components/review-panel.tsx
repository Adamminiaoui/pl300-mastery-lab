"use client";

interface ReviewPanelProps {
  markedQuestionIds: number[];
  incorrectQuestionIds: number[];
  onJumpToQuestion: (questionId: number) => void;
}

export function ReviewPanel({
  markedQuestionIds,
  incorrectQuestionIds,
  onJumpToQuestion,
}: ReviewPanelProps) {
  return (
    <aside className="space-y-5 rounded-[1.75rem] border border-white/10 bg-[color:var(--color-panel)] p-5">
      <div>
        <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
          Marked
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {markedQuestionIds.length === 0 ? (
            <div className="text-sm text-[color:var(--color-muted)]">No marked questions.</div>
          ) : (
            markedQuestionIds.map((questionId) => (
              <button
                key={`marked-${questionId}`}
                type="button"
                onClick={() => onJumpToQuestion(questionId)}
                className="rounded-full border border-amber-400/50 px-3 py-1 text-sm font-semibold text-amber-500"
              >
                Q{questionId}
              </button>
            ))
          )}
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
          Incorrect
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {incorrectQuestionIds.length === 0 ? (
            <div className="text-sm text-[color:var(--color-muted)]">No incorrect questions yet.</div>
          ) : (
            incorrectQuestionIds.map((questionId) => (
              <button
                key={`incorrect-${questionId}`}
                type="button"
                onClick={() => onJumpToQuestion(questionId)}
                className="rounded-full border border-rose-400/50 px-3 py-1 text-sm font-semibold text-rose-500"
              >
                Q{questionId}
              </button>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
