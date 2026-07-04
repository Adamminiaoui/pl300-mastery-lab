import type { Question, QuestionResponse } from "@/lib/types";
import { AnswerAreaShell } from "@/components/questions/answer-area-shell";

interface MultipleChoiceQuestionProps {
  question: Question;
  response?: QuestionResponse;
  disabled?: boolean;
  revealAnswer?: boolean;
  onChange: (response: QuestionResponse) => void;
}

export function MultipleChoiceQuestion({
  question,
  response,
  disabled,
  revealAnswer,
  onChange,
}: MultipleChoiceQuestionProps) {
  const selected = new Set(response?.multi ?? []);
  const expected = new Set(question.correctAnswers ?? []);

  return (
    <AnswerAreaShell subtitle="Select all answer choices that apply.">
      {question.options.map((option) => {
        const checked = selected.has(option.id);
        const tone = revealAnswer
          ? expected.has(option.id)
            ? "correct"
            : checked
              ? "incorrect"
              : "default"
          : checked
            ? "selected"
            : "default";
        const optionClass =
          tone === "correct"
            ? "border-emerald-500/50 bg-emerald-500/10"
            : tone === "incorrect"
              ? "border-rose-500/50 bg-rose-500/10"
              : checked
                ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10"
                : "border-white/10 bg-black/5 hover:border-[color:var(--color-accent)]/40";
        const badgeClass =
          tone === "correct"
            ? "border-emerald-500/60 text-emerald-500"
            : tone === "incorrect"
              ? "border-rose-500/60 text-rose-400"
              : checked
                ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                : "border-white/20 text-[color:var(--color-muted)]";

        return (
          <label
            key={option.id}
            className={`flex cursor-pointer gap-4 rounded-[1.1rem] border px-4 py-4 transition ${optionClass}`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                const next = new Set(selected);
                if (next.has(option.id)) {
                  next.delete(option.id);
                } else {
                  next.add(option.id);
                }
                onChange({ multi: Array.from(next) });
              }}
            />
            <span
              className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold ${badgeClass}`}
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
