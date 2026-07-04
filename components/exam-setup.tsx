"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { examBlueprint } from "@/lib/questions";
import { useQuizStore } from "@/store/quiz-store";

export function ExamSetup() {
  const router = useRouter();
  const startExamSession = useQuizStore((state) => state.startExamSession);
  const existing = useQuizStore((state) => state.sessions.exam);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(120);

  return (
    <section className="mx-auto max-w-4xl space-y-6 rounded-[2rem] border border-white/10 bg-[color:var(--color-panel)] p-8">
      <div>
        <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
          Exam Setup
        </div>
        <h1 className="mt-3 text-4xl font-semibold">Timed 60-question exam</h1>
      </div>

      <label className="space-y-2">
        <div className="text-sm font-semibold">Timer in minutes</div>
        <input
          type="number"
          min={30}
          max={240}
          step={5}
          value={timeLimitMinutes}
          onChange={(event) => setTimeLimitMinutes(Number(event.target.value))}
          className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3"
        />
      </label>

      <div className="rounded-[1.5rem] border border-white/10 bg-black/5 p-4 text-sm leading-7 text-[color:var(--color-muted)]">
        Each exam pulls 60 questions from all 301 questions by following the PL-300 skill blueprint instead of
        using a pure random draw. Answers stay hidden until you submit.
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {examBlueprint.map((item) => (
          <div
            key={item.id}
            className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="text-sm font-semibold text-[color:var(--color-text)]">{item.label}</div>
            <div className="mt-1 text-sm text-[color:var(--color-muted)]">
              {item.questionCount} questions
            </div>
            <div className="mt-2 text-xs uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
              {item.percentageRange}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            startExamSession({ timeLimitMinutes });
            router.push("/exam/session");
          }}
          className="rounded-full bg-[color:var(--color-accent)] px-6 py-3 text-sm font-semibold text-white"
        >
          Start exam
        </button>
        {existing ? (
          <button
            type="button"
            onClick={() => router.push("/exam/session")}
            className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold"
          >
            Resume current exam
          </button>
        ) : null}
      </div>
    </section>
  );
}
