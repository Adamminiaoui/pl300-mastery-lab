"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { questionStats } from "@/lib/questions";
import { useQuizStore } from "@/store/quiz-store";

export function PracticeSetup() {
  const router = useRouter();
  const startPracticeSession = useQuizStore((state) => state.startPracticeSession);
  const questionProgress = useQuizStore((state) => state.questionProgress);
  const existing = useQuizStore((state) => state.sessions.practice);
  const [scope, setScope] = useState<"all" | "range" | "incorrect">("all");
  const [startId, setStartId] = useState(1);
  const [endId, setEndId] = useState(questionStats.total);

  const incorrectOnlyCount = Object.values(questionProgress).filter(
    (item) => item.lastOutcome === "incorrect",
  ).length;

  return (
    <section className="mx-auto max-w-4xl space-y-6 rounded-[2rem] border border-white/10 bg-[color:var(--color-panel)] p-8">
      <div>
        <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
          Practice Setup
        </div>
        <h1 className="mt-3 text-4xl font-semibold">Choose your practice scope</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["all", "All questions", "Use the full 301-question bank."],
          ["range", "Question range", "Focus on a custom contiguous range."],
          ["incorrect", "Incorrect only", "Retry the questions you last missed."],
        ].map(([value, label, description]) => (
          <button
            key={value}
            type="button"
            onClick={() => setScope(value as "all" | "range" | "incorrect")}
            className={`rounded-[1.5rem] border p-5 text-left transition ${
              scope === value
                ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10"
                : "border-white/10 bg-black/5"
            }`}
          >
            <div className="text-lg font-semibold">{label}</div>
            <div className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
              {description}
            </div>
          </button>
        ))}
      </div>

      {scope === "range" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <div className="text-sm font-semibold">Start question</div>
            <input
              type="number"
              min={1}
              max={questionStats.total}
              value={startId}
              onChange={(event) => setStartId(Number(event.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3"
            />
          </label>
          <label className="space-y-2">
            <div className="text-sm font-semibold">End question</div>
            <input
              type="number"
              min={1}
              max={questionStats.total}
              value={endId}
              onChange={(event) => setEndId(Number(event.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3"
            />
          </label>
        </div>
      ) : null}

      {scope === "incorrect" ? (
        <div className="rounded-[1.5rem] border border-white/10 bg-black/5 p-4 text-sm text-[color:var(--color-muted)]">
          {incorrectOnlyCount > 0
            ? `${incorrectOnlyCount} questions are currently flagged as incorrect.`
            : "No incorrect questions are tracked yet, so this mode will fall back to all questions."}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            startPracticeSession({ scope, startId, endId });
            router.push("/practice/session");
          }}
          className="rounded-full bg-[color:var(--color-accent)] px-6 py-3 text-sm font-semibold text-white"
        >
          Start practice session
        </button>
        {existing ? (
          <button
            type="button"
            onClick={() => router.push("/practice/session")}
            className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold"
          >
            Resume current session
          </button>
        ) : null}
      </div>
    </section>
  );
}
