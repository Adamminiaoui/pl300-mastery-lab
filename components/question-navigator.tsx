"use client";

import type { QuizSession } from "@/lib/types";

interface QuestionNavigatorProps {
  session: QuizSession;
  onJump: (index: number) => void;
  incorrectIds?: number[];
  getDisplayLabel?: (questionId: number, index: number) => string;
}

export function QuestionNavigator({
  session,
  onJump,
  incorrectIds = [],
  getDisplayLabel,
}: QuestionNavigatorProps) {
  const incorrectSet = new Set(incorrectIds);
  const responseIds = new Set(Object.keys(session.responses).map(Number));
  const markedIds = new Set(session.markedQuestionIds);
  const revealedIds = new Set(session.revealedQuestionIds);

  return (
    <aside className="rounded-[1.75rem] border border-white/10 bg-[color:var(--color-panel)] p-5">
      <div className="mb-4 text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
        Navigator
      </div>
      <div className="grid max-h-[70vh] grid-cols-5 gap-2 overflow-y-auto pr-1">
        {session.questionIds.map((questionId, index) => {
          const isActive = index === session.currentIndex;
          const isAnswered = responseIds.has(questionId);
          const isIncorrect = incorrectSet.has(questionId);
          const isMarked = markedIds.has(questionId);
          const isRevealed = revealedIds.has(questionId);
          return (
            <button
              key={questionId}
              type="button"
              onClick={() => onJump(index)}
              className={[
                "relative rounded-2xl border px-0 py-3 text-sm font-semibold transition",
                isActive
                  ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]"
                  : "border-white/10 bg-black/5 text-[color:var(--color-text)] hover:border-[color:var(--color-accent)]/50",
                isAnswered ? "shadow-[inset_0_0_0_1px_rgba(15,118,110,0.2)]" : "",
                isIncorrect ? "border-rose-500/50 text-rose-500" : "",
              ].join(" ")}
            >
              {getDisplayLabel ? getDisplayLabel(questionId, index) : String(questionId)}
              {isMarked ? (
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-amber-400" />
              ) : null}
              {isRevealed && !isIncorrect ? (
                <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-500" />
              ) : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
