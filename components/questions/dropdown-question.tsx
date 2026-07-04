import { normalizeComparableText } from "@/lib/helpers";
import type { Question, QuestionResponse } from "@/lib/types";
import { AnswerAreaShell } from "@/components/questions/answer-area-shell";
import { ExamSelect } from "@/components/questions/exam-select";

interface DropdownQuestionProps {
  question: Question;
  response?: QuestionResponse;
  disabled?: boolean;
  revealAnswer?: boolean;
  onChange: (response: QuestionResponse) => void;
}

export function DropdownQuestion({
  question,
  response,
  disabled,
  revealAnswer,
  onChange,
}: DropdownQuestionProps) {
  const fields = response?.fields ?? {};

  return (
    <AnswerAreaShell subtitle="Use the answer area to choose a value for each prompt.">
      {(question.dropdowns ?? []).map((dropdown) => {
        const value = fields[dropdown.id] ?? "";
        const isCorrect =
          normalizeComparableText(value) === normalizeComparableText(dropdown.correctAnswer);
        const tone = revealAnswer ? (isCorrect ? "correct" : "incorrect") : "default";
        const wrapperClass =
          tone === "correct"
            ? "border-emerald-500/30 bg-emerald-500/8"
            : tone === "incorrect"
              ? "border-rose-500/30 bg-rose-500/8"
              : "border-white/10 bg-black/5";

        return (
          <div
            key={dropdown.id}
            className={`grid gap-4 rounded-[1.1rem] border px-4 py-4 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center ${wrapperClass}`}
          >
            <div className="text-base font-semibold text-[color:var(--color-text)]">
              {dropdown.label}
            </div>
            <ExamSelect
              value={value}
              tone={tone}
              disabled={disabled}
              options={dropdown.options.map((option) => ({ value: option, label: option }))}
              onChange={(nextValue) =>
                onChange({
                  fields: {
                    ...fields,
                    [dropdown.id]: nextValue,
                  },
                })
              }
            />
          </div>
        );
      })}
    </AnswerAreaShell>
  );
}
