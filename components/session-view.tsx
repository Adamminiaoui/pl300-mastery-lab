"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { ExamTimer } from "@/components/exam-timer";
import { ProgressBar } from "@/components/progress-bar";
import { QuestionNavigator } from "@/components/question-navigator";
import { QuestionRenderer } from "@/components/question-renderer";
import { ReviewPanel } from "@/components/review-panel";
import { formatPercent } from "@/lib/helpers";
import { getIncorrectQuestionIds, getQuestion } from "@/lib/questions";
import { scoreQuestion } from "@/lib/scoring";
import type { SessionMode } from "@/lib/types";
import { useQuizStore } from "@/store/quiz-store";

interface SessionViewProps {
  mode: SessionMode;
}

export function SessionView({ mode }: SessionViewProps) {
  const router = useRouter();
  const session = useQuizStore((state) => state.sessions[mode]);
  const questionProgress = useQuizStore((state) => state.questionProgress);
  const saveResponse = useQuizStore((state) => state.saveResponse);
  const jumpToQuestion = useQuizStore((state) => state.jumpToQuestion);
  const moveQuestion = useQuizStore((state) => state.moveQuestion);
  const toggleMarked = useQuizStore((state) => state.toggleMarked);
  const revealPracticeAnswer = useQuizStore((state) => state.revealPracticeAnswer);
  const submitSession = useQuizStore((state) => state.submitSession);

  const incorrectGlobal = useMemo(
    () => getIncorrectQuestionIds(questionProgress),
    [questionProgress],
  );

  if (!session) {
    const href = mode === "practice" ? "/practice" : mode === "exam" ? "/exam" : "/mock";
    return (
      <div className="rounded-[2rem] border border-white/10 bg-[color:var(--color-panel)] p-8 text-center">
        <div className="text-sm text-[color:var(--color-muted)]">No active session.</div>
        <Link
          href={href}
          className="mt-4 inline-flex rounded-full border border-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--color-accent)]"
        >
          Go to setup
        </Link>
      </div>
    );
  }

  const questionId = session.questionIds[session.currentIndex];
  const question = getQuestion(questionId);
  const response = session.responses[questionId];
  const revealAnswer =
    mode === "practice"
      ? session.revealedQuestionIds.includes(questionId)
      : Boolean(session.submitted);
  const incorrectIds =
    mode === "practice" || session.submitted
      ? session.questionIds.filter((id) => {
          const item = getQuestion(id);
          if (!item) {
            return false;
          }
          const currentResponse = session.responses[id];
          if (!currentResponse) {
            return false;
          }
          return !scoreQuestion(item, currentResponse).correct;
        })
      : incorrectGlobal.filter((id) => session.questionIds.includes(id));
  const answeredCount = Object.keys(session.responses).length;
  const practiceChecks = session.revealedQuestionIds
    .map((id) => {
      const item = getQuestion(id);
      const currentResponse = session.responses[id];
      if (!item || !currentResponse) {
        return null;
      }
      return scoreQuestion(item, currentResponse);
    })
    .filter(Boolean);
  const practiceCorrect = practiceChecks.filter((item) => item?.correct).length;
  const practiceScorePercent =
    practiceChecks.length === 0 ? 0 : (practiceCorrect / practiceChecks.length) * 100;

  if (!question) {
    return null;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_16rem]">
      <QuestionNavigator
        session={session}
        incorrectIds={incorrectIds}
        onJump={(index) => jumpToQuestion(mode, index)}
      />

      <div className="space-y-6">
        <section className="rounded-[1.85rem] border border-white/10 bg-[color:var(--color-panel)] p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
                {mode}
              </div>
              <h1 className="mt-2 text-3xl font-semibold text-[color:var(--color-text)]">
                {session.configLabel}
              </h1>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {mode === "exam" || mode === "mock" ? (
                <ExamTimer
                  mode={mode}
                  onExpire={() => {
                    submitSession(mode);
                    router.push(`/results?mode=${mode}`);
                  }}
                />
              ) : (
                <div className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-sm font-semibold">
                  Practice score {formatPercent(practiceScorePercent)}
                </div>
              )}
              <button
                type="button"
                onClick={() => toggleMarked(mode, question.id)}
                className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-sm font-semibold hover:border-amber-400 hover:text-amber-500"
              >
                {session.markedQuestionIds.includes(question.id)
                  ? "Unmark question"
                  : "Mark for review"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-center">
            <ProgressBar
              value={session.currentIndex + 1}
              total={session.questionIds.length}
              label={`Question ${session.currentIndex + 1}`}
            />
            <div className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold">
              Answered {answeredCount}
            </div>
            <div className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold">
              Current question #{question.id}
            </div>
          </div>
        </section>

        <QuestionRenderer
          question={question}
          response={response}
          disabled={session.submitted}
          revealAnswer={revealAnswer}
          onChange={(nextResponse) => saveResponse(mode, question.id, nextResponse)}
        />

        {!session.submitted ? (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-white/10 bg-[color:var(--color-panel)] p-5">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => moveQuestion(mode, -1)}
                disabled={session.currentIndex === 0}
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => moveQuestion(mode, 1)}
                disabled={session.currentIndex === session.questionIds.length - 1}
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {mode === "practice" ? (
                <button
                  type="button"
                  onClick={() => revealPracticeAnswer(question.id)}
                  className="rounded-full border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/12 px-5 py-3 text-sm font-semibold text-[color:var(--color-accent)]"
                >
                  Check answer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    submitSession(mode);
                    router.push(`/results?mode=${mode}`);
                  }}
                  className="rounded-full border border-[color:var(--color-accent)] bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white"
                >
                  Submit {mode === "exam" ? "exam" : "mock"}
                </button>
              )}
            </div>
          </section>
        ) : null}
      </div>

      <ReviewPanel
        markedQuestionIds={session.markedQuestionIds}
        incorrectQuestionIds={incorrectIds}
        onJumpToQuestion={(targetQuestionId) => {
          const index = session.questionIds.indexOf(targetQuestionId);
          if (index >= 0) {
            jumpToQuestion(mode, index);
          }
        }}
      />
    </div>
  );
}
