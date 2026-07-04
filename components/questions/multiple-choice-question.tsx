import type { Question, QuestionResponse } from "@/lib/types";

interface MultipleChoiceQuestionProps {
  question: Question;
  response?: QuestionResponse;
  disabled?: boolean;
  onChange: (response: QuestionResponse) => void;
}

export function MultipleChoiceQuestion({
  question,
  response,
  disabled,
  onChange,
}: MultipleChoiceQuestionProps) {
  const selected = new Set(response?.multi ?? []);

  return (
    <div className="space-y-3">
      {question.options.map((option) => (
        <label
          key={option.id}
          className="flex cursor-pointer gap-4 rounded-[1.35rem] border border-white/10 bg-black/5 px-4 py-4 transition hover:border-[color:var(--color-accent)]"
        >
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[color:var(--color-accent)]"
            checked={selected.has(option.id)}
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
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
              {option.id}
            </div>
            <div className="mt-2 whitespace-pre-wrap text-[color:var(--color-text)]">
              {option.text}
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}
