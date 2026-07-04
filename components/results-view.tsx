"use client";

import Link from "next/link";

import { QuestionRenderer } from "@/components/question-renderer";
import { ScoreSummary } from "@/components/score-summary";
import { getQuestions } from "@/lib/questions";
import type { SessionMode } from "@/lib/types";
import { useQuizStore } from "@/store/quiz-store";

interface ResultsViewProps {
  mode: Extract<SessionMode, "exam" | "mock">;
}

export function ResultsView({ mode }: ResultsViewProps) {
  const session = useQuizStore((state) => state.sessions[mode]);

  if (!session?.result) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-[color:var(--color-panel)] p-8 text-center">
        <div className="text-sm text-[color:var(--color-muted)]">No result is available yet.</div>
        <Link
          href={mode === "mock" ? "/mock" : "/exam"}
          className="mt-4 inline-flex rounded-full border border-white/10 px-5 py-3 text-sm font-semibold"
        >
          Return to setup
        </Link>
      </div>
    );
  }

  const questions = getQuestions(session.questionIds);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[color:var(--color-panel)] p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
              {mode} results
            </div>
            <h1 className="mt-3 text-4xl font-semibold">
              {mode === "exam" ? "60-question exam review" : "Full mock review"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={mode === "mock" ? "/mock" : "/exam"}
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold"
            >
              Restart
            </Link>
            <Link
              href="/review"
              className="rounded-full border border-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--color-accent)]"
            >
              Open review queue
            </Link>
          </div>
        </div>
        <div className="mt-6">
          <ScoreSummary result={session.result} />
        </div>
      </section>

      <div className="space-y-6">
        {questions.map((question) => (
          <section
            key={question.id}
            className="rounded-[2rem] border border-white/10 bg-[color:var(--color-panel)] p-6"
          >
            <div className="mb-4 text-sm font-semibold text-[color:var(--color-muted)]">
              Your response is shown below. Correct answer and explanation are revealed.
            </div>
            <QuestionRenderer
              question={question}
              response={session.responses[question.id]}
              disabled
              revealAnswer
              onChange={() => undefined}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
