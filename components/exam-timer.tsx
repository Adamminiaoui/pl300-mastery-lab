"use client";

import { useEffect } from "react";

import { formatDuration } from "@/lib/helpers";
import { useQuizStore } from "@/store/quiz-store";
import type { SessionMode } from "@/lib/types";

interface ExamTimerProps {
  mode: Extract<SessionMode, "exam" | "mock">;
  onExpire: () => void;
}

export function ExamTimer({ mode, onExpire }: ExamTimerProps) {
  const session = useQuizStore((state) => state.sessions[mode]);
  const setTimeRemaining = useQuizStore((state) => state.setTimeRemaining);

  useEffect(() => {
    if (!session || session.submitted || session.timeRemainingSeconds == null) {
      return;
    }

    const interval = window.setInterval(() => {
      const liveSession = useQuizStore.getState().sessions[mode];
      if (!liveSession || liveSession.submitted || liveSession.timeRemainingSeconds == null) {
        window.clearInterval(interval);
        return;
      }

      const nextValue = liveSession.timeRemainingSeconds - 1;
      if (nextValue <= 0) {
        setTimeRemaining(mode, 0);
        window.clearInterval(interval);
        onExpire();
        return;
      }

      setTimeRemaining(mode, nextValue);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [mode, onExpire, session, setTimeRemaining]);

  if (!session || session.timeRemainingSeconds == null) {
    return null;
  }

  return (
    <div className="rounded-full border border-white/10 bg-[color:var(--color-panel)] px-4 py-2 text-sm font-semibold text-[color:var(--color-text)]">
      {formatDuration(session.timeRemainingSeconds)}
    </div>
  );
}
