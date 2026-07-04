"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useQuizStore } from "@/store/quiz-store";

export function MockSetup() {
  const router = useRouter();
  const startMockSession = useQuizStore((state) => state.startMockSession);
  const existing = useQuizStore((state) => state.sessions.mock);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(0);

  return (
    <section className="mx-auto max-w-4xl space-y-6 rounded-[2rem] border border-white/10 bg-[color:var(--color-panel)] p-8">
      <div>
        <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
          Full Mock Setup
        </div>
        <h1 className="mt-3 text-4xl font-semibold">All 301 questions with save and resume</h1>
      </div>

      <label className="space-y-2">
        <div className="text-sm font-semibold">Optional timer in minutes</div>
        <input
          type="number"
          min={0}
          max={600}
          step={15}
          value={timeLimitMinutes}
          onChange={(event) => setTimeLimitMinutes(Number(event.target.value))}
          className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3"
        />
      </label>

      <div className="rounded-[1.5rem] border border-white/10 bg-black/5 p-4 text-sm leading-7 text-[color:var(--color-muted)]">
        This mode keeps your progress in local storage, so you can stop and come back later.
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            startMockSession({ timeLimitMinutes: Math.max(timeLimitMinutes, 0) });
            router.push("/mock/session");
          }}
          className="rounded-full bg-[color:var(--color-accent)] px-6 py-3 text-sm font-semibold text-white"
        >
          Start full mock
        </button>
        {existing ? (
          <button
            type="button"
            onClick={() => router.push("/mock/session")}
            className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold"
          >
            Resume saved mock
          </button>
        ) : null}
      </div>
    </section>
  );
}
