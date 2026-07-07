import { titleCase } from "@/lib/helpers";
import { scoreQuestion } from "@/lib/scoring";
import type { Question, QuestionResponse } from "@/lib/types";

import { DragDropQuestion } from "@/components/questions/drag-drop-question";
import { DropdownQuestion } from "@/components/questions/dropdown-question";
import { HotspotQuestion } from "@/components/questions/hotspot-question";
import { MultipleChoiceQuestion } from "@/components/questions/multiple-choice-question";
import { SingleChoiceQuestion } from "@/components/questions/single-choice-question";

interface QuestionRendererProps {
  question: Question;
  response?: QuestionResponse;
  disabled?: boolean;
  revealAnswer?: boolean;
  displayTitle?: string;
  onChange: (response: QuestionResponse) => void;
}

function renderAnswerKey(question: Question) {
  if (question.dropdowns?.length) {
    return (
      <ul className="space-y-2">
        {question.dropdowns.map((dropdown) => (
          <li key={dropdown.id}>
            <span className="font-semibold">{dropdown.label}:</span> {dropdown.correctAnswer}
          </li>
        ))}
      </ul>
    );
  }

  if (question.dropZones?.length && question.dragItems?.length) {
    const itemMap = new Map(question.dragItems.map((item) => [item.id, item.text]));
    if (question.acceptAnyOrder) {
      const correctItems = Array.from(
        new Set(
          question.dropZones.map((zone) => itemMap.get(zone.correctItemId) ?? zone.correctItemId),
        ),
      );

      return (
        <div className="space-y-3">
          <div className="font-semibold">Any order:</div>
          <ul className="space-y-2">
            {correctItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <ul className="space-y-2">
        {question.dropZones.map((zone) => (
          <li key={zone.id}>
            <span className="font-semibold">{zone.label}:</span>{" "}
            {itemMap.get(zone.correctItemId) ?? zone.correctItemId}
          </li>
        ))}
      </ul>
    );
  }

  if (question.correctAnswers?.length) {
    return <div>{question.correctAnswers.join(", ")}</div>;
  }

  return <div>{question.correctAnswer}</div>;
}

export function QuestionRenderer({
  question,
  response,
  disabled,
  revealAnswer,
  displayTitle,
  onChange,
}: QuestionRendererProps) {
  const revealedScore = revealAnswer ? scoreQuestion(question, response) : undefined;
  const answerToneClass = revealedScore?.correct
    ? "border-emerald-500/20 bg-emerald-500/8"
    : "border-rose-500/20 bg-rose-500/8";
  const answerLabelClass = revealedScore?.correct ? "text-emerald-500" : "text-rose-400";
  const heading = displayTitle ?? question.title;

  return (
    <article className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-black/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
          {titleCase(question.type)}
        </span>
        {question.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-[color:var(--color-muted)]"
          >
            {tag}
          </span>
        ))}
        {question.manualReview ? (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-500">
            Needs manual review
          </span>
        ) : null}
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[color:var(--color-panel)] p-6">
        <h2 className="text-2xl font-semibold text-[color:var(--color-text)]">{heading}</h2>
        <div className="mt-4 whitespace-pre-wrap text-base leading-8 text-[color:var(--color-text)]">
          {question.questionText}
        </div>

        {question.assets.length > 0 ? (
          <div className="mt-6 grid gap-4">
            {question.assets.map((asset) => (
              <div
                key={asset}
                className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/70 p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset}
                  alt={`${heading} exhibit`}
                  className="w-full rounded-[1rem] object-contain"
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {question.type === "multiple_choice" ? (
        <MultipleChoiceQuestion
          question={question}
          response={response}
          disabled={disabled}
          revealAnswer={revealAnswer}
          onChange={onChange}
        />
      ) : null}
      {(question.type === "single_choice" || question.type === "yes_no" || question.type === "case_study") ? (
        <SingleChoiceQuestion
          question={question}
          response={response}
          disabled={disabled}
          revealAnswer={revealAnswer}
          onChange={onChange}
        />
      ) : null}
      {question.type === "dropdown" ? (
        <DropdownQuestion
          question={question}
          response={response}
          disabled={disabled}
          revealAnswer={revealAnswer}
          onChange={onChange}
        />
      ) : null}
      {question.type === "hotspot" ? (
        <HotspotQuestion
          question={question}
          response={response}
          disabled={disabled}
          revealAnswer={revealAnswer}
          onChange={onChange}
        />
      ) : null}
      {(question.type === "drag_drop" ||
        question.type === "ordering" ||
        question.type === "select_place") ? (
        <DragDropQuestion
          question={question}
          response={response}
          disabled={disabled}
          revealAnswer={revealAnswer}
          onChange={onChange}
        />
      ) : null}

      {revealAnswer ? (
        <section className={`rounded-[1.75rem] border p-6 ${answerToneClass}`}>
          <div className={`text-xs uppercase tracking-[0.28em] ${answerLabelClass}`}>
            {revealedScore?.correct ? "Correct" : "Incorrect"}
          </div>
          <div className="mt-4 text-sm leading-7 text-[color:var(--color-text)]">
            {renderAnswerKey(question)}
          </div>
          <div className="mt-6 text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
            Explanation
          </div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[color:var(--color-text)]">
            {question.explanation}
          </div>
          {question.references.length > 0 ? (
            <div className="mt-5 space-y-2">
              <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
                References
              </div>
              {question.references.map((reference) => (
                <a
                  key={reference}
                  href={reference}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm text-[color:var(--color-accent)] hover:underline"
                >
                  {reference}
                </a>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
