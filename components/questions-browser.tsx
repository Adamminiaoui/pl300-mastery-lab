"use client";

import { useMemo, useState } from "react";

import { questionStats, questions, topicOptions } from "@/lib/questions";
import { titleCase } from "@/lib/helpers";
import { useQuizStore } from "@/store/quiz-store";

export function QuestionsBrowser() {
  const progress = useQuizStore((state) => state.questionProgress);
  const sessions = useQuizStore((state) => state.sessions);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [topic, setTopic] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [hasImage, setHasImage] = useState(false);
  const [hasExplanation, setHasExplanation] = useState(false);
  const [markedOnly, setMarkedOnly] = useState(false);

  const filtered = useMemo(() => {
    const marked = new Set(
      Object.values(sessions).flatMap((session) => session?.markedQuestionIds ?? []),
    );

    return questions.filter((question) => {
      const query = search.trim().toLowerCase();
      const progressItem = progress[question.id];

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
      if (outcome === "correct" && progressItem?.lastOutcome !== "correct") {
        return false;
      }
      if (outcome === "incorrect" && progressItem?.lastOutcome !== "incorrect") {
        return false;
      }
      if (hasImage && !question.hasImage) {
        return false;
      }
      if (hasExplanation && !question.explanation.trim()) {
        return false;
      }
      if (markedOnly && !marked.has(question.id)) {
        return false;
      }
      return true;
    });
  }, [hasExplanation, hasImage, markedOnly, outcome, progress, search, sessions, topic, type]);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/10 bg-[color:var(--color-panel)] p-6">
        <div className="grid gap-4 lg:grid-cols-4">
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
          <select
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            className="rounded-2xl border border-white/10 bg-transparent px-4 py-3"
          >
            <option value="all">Any result</option>
            <option value="correct">Correct</option>
            <option value="incorrect">Incorrect</option>
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasImage}
              onChange={(event) => setHasImage(event.target.checked)}
            />
            Has image
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasExplanation}
              onChange={(event) => setHasExplanation(event.target.checked)}
            />
            Has explanation
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={markedOnly}
              onChange={(event) => setMarkedOnly(event.target.checked)}
            />
            Marked for review
          </label>
        </div>
      </section>

      <div className="grid gap-4">
        {filtered.map((question) => (
          <article
            key={question.id}
            className="rounded-[1.5rem] border border-white/10 bg-[color:var(--color-panel)] p-5"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold">
                Q{question.id} <span className="text-[color:var(--color-muted)]">·</span>{" "}
                {titleCase(question.type)}
              </h2>
              {question.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-[color:var(--color-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm leading-7 text-[color:var(--color-muted)]">
              {question.questionText}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
