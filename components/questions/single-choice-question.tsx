import type { Question, QuestionResponse } from "@/lib/types";
import { AnswerAreaShell } from "@/components/questions/answer-area-shell";

interface SingleChoiceQuestionProps {
  question: Question;
  response?: QuestionResponse;
  disabled?: boolean;
  revealAnswer?: boolean;
  onChange: (response: QuestionResponse) => void;
}

export function SingleChoiceQuestion({
  question,
  response,
  disabled,
  revealAnswer,
  onChange,
}: SingleChoiceQuestionProps) {
  const isYesNo =
    question.options.length === 2 &&
    question.options.every((option) => ["yes", "no"].includes(option.text.trim().toLowerCase()));
  const correctOptionId = question.correctAnswer ?? "";

  function getTone(optionId: string, selected: boolean) {
    if (!revealAnswer) {
      return selected ? "selected" : "default";
    }
    if (optionId === correctOptionId) {
      return "correct";
    }
    if (selected) {
      return "incorrect";
    }
    return "default";
  }

  if (isYesNo) {
    return (
      <AnswerAreaShell subtitle="Choose Yes or No.">
        <div className="grid gap-4 md:grid-cols-2">
          {question.options.map((option) => {
            const selected = response?.single === option.id;
            const tone = getTone(option.id, selected);
            const buttonClass =
              tone === "correct"
                ? "border-emerald-500/50 bg-emerald-500/12"
                : tone === "incorrect"
                  ? "border-rose-500/50 bg-rose-500/12"
                  : tone === "selected"
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/12"
                    : "border-white/10 bg-black/5 hover:border-[color:var(--color-accent)]/40";
            const badgeClass =
              tone === "correct"
                ? "border-emerald-500/60 text-emerald-500"
                : tone === "incorrect"
                  ? "border-rose-500/60 text-rose-400"
                  : selected
                    ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                    : "border-white/20 text-[color:var(--color-muted)]";

            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ single: option.id })}
                className={`rounded-[1.2rem] border px-5 py-5 text-left transition ${buttonClass}`}
              >
                <div className={`text-xs uppercase tracking-[0.24em] ${badgeClass}`}>
                  {option.id}
                </div>
                <div className="mt-3 text-xl font-semibold text-[color:var(--color-text)]">
                  {option.text}
                </div>
              </button>
            );
          })}
        </div>
      </AnswerAreaShell>
    );
  }

  return (
    <AnswerAreaShell subtitle="Select one answer choice.">
      {question.options.map((option) => {
        const selected = response?.single === option.id;
        const tone = getTone(option.id, selected);
        const optionClass =
          tone === "correct"
            ? "border-emerald-500/50 bg-emerald-500/10"
            : tone === "incorrect"
              ? "border-rose-500/50 bg-rose-500/10"
              : selected
                ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10"
                : "border-white/10 bg-black/5 hover:border-[color:var(--color-accent)]/40";
        const badgeClass =
          tone === "correct"
            ? "border-emerald-500/60 text-emerald-500"
            : tone === "incorrect"
              ? "border-rose-500/60 text-rose-400"
              : selected
                ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                : "border-white/20 text-[color:var(--color-muted)]";

        return (
          <label
            key={option.id}
            className={`flex cursor-pointer gap-4 rounded-[1.1rem] border px-4 py-4 transition ${optionClass}`}
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              className="sr-only"
              checked={selected}
              disabled={disabled}
              onChange={() => onChange({ single: option.id })}
            />
            <span
              className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${badgeClass}`}
            >
              {option.id}
            </span>
            <span className="whitespace-pre-wrap text-[color:var(--color-text)]">{option.text}</span>
          </label>
        );
      })}
    </AnswerAreaShell>
  );
}
