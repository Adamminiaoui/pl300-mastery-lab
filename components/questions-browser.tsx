"use client";

import { useMemo, useState } from "react";

import { QuestionRenderer } from "@/components/question-renderer";
import { titleCase } from "@/lib/helpers";
import { questionStats, questions, topicOptions } from "@/lib/questions";
import { scoreQuestion } from "@/lib/scoring";
import type { QuestionResponse } from "@/lib/types";
import { useQuizStore } from "@/store/quiz-store";

function hasAnyResponse(response?: QuestionResponse) {
  if (!response) {
    return false;
  }

  if (response.single) {
    return true;
  }

  if (response.multi?.length) {
    return true;
  }

  if (response.fields) {
    return Object.values(response.fields).some(Boolean);
  }

  return false;
}

export function QuestionsBrowser() {
  const progress = useQuizStore((state) => state.questionProgress);
  const recordQuestionOutcome = useQuizStore((state) => state.recordQuestionOutcome);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [topic, setTopic] = useState("all");
  const [selectedQuestionId, setSelectedQuestionId] = useState<number>(questions[0]?.id ?? 1);
  const [responses, setResponses] = useState<Record<number, QuestionResponse>>({});
  const [revealedQuestionIds, setRevealedQuestionIds] = useState<number[]>([]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return questions.filter((question) => {
      if (query) {
        const matchesNumber = String(question.id).includes(query);
        const matchesText =
          question.questionText.toLowerCase().includes(query) ||
          question.tags.join(" ").toLowerCase().includes(query);
        if (!matchesNumber && !matchesText) {
          return false;
        }
      }

      if (type !== "all" && question.type !== type) {
        return false;
      }
      if (topic !== "all" && !question.tags.includes(topic)) {
        return false;
      }

      return true;
    });
  }, [search, topic, type]);

  const activeQuestionId = filtered.some((question) => question.id === selectedQuestionId)
    ? selectedQuestionId
    : (filtered[0]?.id ?? 0);
  const selectedIndex = filtered.findIndex((question) => question.id === activeQuestionId);
  const selectedQuestion = selectedIndex >= 0 ? filtered[selectedIndex] : undefined;
  const selectedResponse = selectedQuestion ? responses[selectedQuestion.id] : undefined;
  const revealAnswer = selectedQuestion
    ? revealedQuestionIds.includes(selectedQuestion.id)
    : false;
  const selectedScore =
    selectedQuestion && revealAnswer
      ? scoreQuestion(selectedQuestion, selectedResponse)
      : undefined;
  const canCheckAnswer = hasAnyResponse(selectedResponse) && Boolean(selectedQuestion) && !revealAnswer;

  const moveSelection = (delta: number) => {
    if (selectedIndex < 0) {
      return;
    }
    const nextQuestion = filtered[selectedIndex + delta];
    if (nextQuestion) {
      setSelectedQuestionId(nextQuestion.id);
    }
  };

  const handleResponseChange = (questionId: number, nextResponse: QuestionResponse) => {
    setResponses((current) => ({
      ...current,
      [questionId]: nextResponse,
    }));
    setRevealedQuestionIds((current) => current.filter((value) => value !== questionId));
  };

  const handleCheckAnswer = () => {
    if (!selectedQuestion || !hasAnyResponse(selectedResponse) || revealAnswer) {
      return;
    }

    const score = scoreQuestion(selectedQuestion, selectedResponse);
    recordQuestionOutcome(selectedQuestion.id, score.correct);
    setRevealedQuestionIds((current) => [...current, selectedQuestion.id]);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/10 bg-[color:var(--color-panel)] p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by number, text, or tag"
            className="rounded-2xl border border-white/10 bg-transparent px-4 py-3"
          />
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="rounded-2xl border border-white/10 bg-transparent px-4 py-3"
          >
            <option value="all">All types</option>
            {Object.keys(questionStats.byType).map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </select>
          <select
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="rounded-2xl border border-white/10 bg-transparent px-4 py-3"
          >
            <option value="all">All topics</option>
            {topicOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

      </section>

      {filtered.length === 0 ? (
        <section className="rounded-[1.75rem] border border-white/10 bg-[color:var(--color-panel)] p-8 text-center">
          <div className="text-lg font-semibold text-[color:var(--color-text)]">
            No questions match the current filters.
          </div>
          <div className="mt-2 text-sm text-[color:var(--color-muted)]">
            Adjust the search or filters to load another question.
          </div>
        </section>
      ) : null}

      {filtered.length > 0 && selectedQuestion ? (
        <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-[1.75rem] border border-white/10 bg-[color:var(--color-panel)] p-5">
              <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
                Question Bank
              </div>
              <div className="mt-3 text-2xl font-semibold text-[color:var(--color-text)]">
                {filtered.length} questions
              </div>
              <div className="mt-2 text-sm text-[color:var(--color-muted)]">
                Interactive review with hidden answers until you check.
              </div>
            </section>

            <div className="space-y-3 xl:max-h-[calc(100vh-16rem)] xl:overflow-y-auto xl:pr-1">
              {filtered.map((question) => {
                const progressItem = progress[question.id];
                const isSelected = question.id === selectedQuestion.id;

                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => setSelectedQuestionId(question.id)}
                    className={`w-full rounded-[1.35rem] border p-4 text-left transition ${
                      isSelected
                        ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10"
                        : "border-white/10 bg-[color:var(--color-panel)] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-semibold text-[color:var(--color-text)]">
                        Q{question.id} - {titleCase(question.type)}
                      </div>
                      {progressItem?.lastOutcome ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                            progressItem.lastOutcome === "correct"
                              ? "bg-emerald-500/12 text-emerald-500"
                              : "bg-rose-500/12 text-rose-400"
                          }`}
                        >
                          {progressItem.lastOutcome}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[color:var(--color-muted)]">
                      {question.questionText}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {question.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[color:var(--color-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-[1.75rem] border border-white/10 bg-[color:var(--color-panel)] p-6">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
                    Question Browser
                  </div>
                  <h1 className="mt-2 text-3xl font-semibold text-[color:var(--color-text)]">
                    Question {selectedQuestion.id}
                  </h1>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-3">
                  <div className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold">
                    {selectedIndex + 1} of {filtered.length}
                  </div>
                  {selectedScore ? (
                    <div
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        selectedScore.correct
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : "border border-rose-500/30 bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {selectedScore.correct ? "Correct" : "Incorrect"}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <QuestionRenderer
              question={selectedQuestion}
              response={selectedResponse}
              revealAnswer={revealAnswer}
              onChange={(nextResponse) => handleResponseChange(selectedQuestion.id, nextResponse)}
            />

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-white/10 bg-[color:var(--color-panel)] p-5">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => moveSelection(-1)}
                  disabled={selectedIndex <= 0}
                  className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => moveSelection(1)}
                  disabled={selectedIndex >= filtered.length - 1}
                  className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>

              <button
                type="button"
                onClick={handleCheckAnswer}
                disabled={!canCheckAnswer}
                className="rounded-full border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/12 px-5 py-3 text-sm font-semibold text-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Check answer
              </button>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
