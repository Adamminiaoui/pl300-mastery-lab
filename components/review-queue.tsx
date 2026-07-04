"use client";

import Link from "next/link";

import { QuestionRenderer } from "@/components/question-renderer";
import { getIncorrectQuestionIds, getQuestions } from "@/lib/questions";
import { useQuizStore } from "@/store/quiz-store";

export function ReviewQueue() {
  const progress = useQuizStore((state) => state.questionProgress);
  const sessions = useQuizStore((state) => state.sessions);

  const markedIds = Array.from(
    new Set(Object.values(sessions).flatMap((session) => session?.markedQuestionIds ?? [])),
  );
  const incorrectIds = getIncorrectQuestionIds(progress);
  const reviewIds = Array.from(new Set([...markedIds, ...incorrectIds])).sort((a, b) => a - b);
  const questions = getQuestions(reviewIds);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[color:var(--color-panel)] p-8">
        <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
          Review Queue
        </div>
        <h1 className="mt-3 text-4xl font-semibold">Marked and incorrect questions</h1>
        <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
          Review {reviewIds.length} questions collected from your current sessions and last-known outcomes.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/practice"
            className="rounded-full border border-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--color-accent)]"
          >
            Start a retry practice
          </Link>
        </div>
      </section>

      {questions.map((question) => (
        <section
          key={question.id}
          className="rounded-[2rem] border border-white/10 bg-[color:var(--color-panel)] p-6"
        >
          <QuestionRenderer
            question={question}
            disabled
            revealAnswer
            onChange={() => undefined}
          />
        </section>
      ))}
    </div>
  );
}
