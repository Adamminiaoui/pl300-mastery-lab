import type { Question, QuestionResponse } from "@/lib/types";

interface SingleChoiceQuestionProps {
  question: Question;
  response?: QuestionResponse;
  disabled?: boolean;
  onChange: (response: QuestionResponse) => void;
}

export function SingleChoiceQuestion({
  question,
  response,
  disabled,
  onChange,
}: SingleChoiceQuestionProps) {
  return (
    <div className="space-y-3">
      {question.options.map((option) => (
        <label
          key={option.id}
          className="flex cursor-pointer gap-4 rounded-[1.35rem] border border-white/10 bg-black/5 px-4 py-4 transition hover:border-[color:var(--color-accent)]"
        >
          <input
            type="radio"
            name={`question-${question.id}`}
            className="mt-1 h-4 w-4 accent-[color:var(--color-accent)]"
            checked={response?.single === option.id}
            disabled={disabled}
            onChange={() => onChange({ single: option.id })}
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
