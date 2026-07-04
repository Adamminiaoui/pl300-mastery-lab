import type { Question, QuestionResponse } from "@/lib/types";

interface DropdownQuestionProps {
  question: Question;
  response?: QuestionResponse;
  disabled?: boolean;
  onChange: (response: QuestionResponse) => void;
}

export function DropdownQuestion({
  question,
  response,
  disabled,
  onChange,
}: DropdownQuestionProps) {
  const fields = response?.fields ?? {};

  return (
    <div className="space-y-4">
      {(question.dropdowns ?? []).map((dropdown) => (
        <div
          key={dropdown.id}
          className="rounded-[1.35rem] border border-white/10 bg-black/5 px-4 py-4"
        >
          <div className="mb-3 text-sm font-semibold text-[color:var(--color-text)]">
            {dropdown.label}
          </div>
          {dropdown.options.length > 0 ? (
            <select
              value={fields[dropdown.id] ?? ""}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  fields: {
                    ...fields,
                    [dropdown.id]: event.target.value,
                  },
                })
              }
              className="w-full rounded-2xl border border-white/12 bg-transparent px-4 py-3 text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
            >
              <option value="">Select an answer</option>
              {dropdown.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={fields[dropdown.id] ?? ""}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  fields: {
                    ...fields,
                    [dropdown.id]: event.target.value,
                  },
                })
              }
              placeholder="Enter the selected value from the exhibit"
              className="w-full rounded-2xl border border-white/12 bg-transparent px-4 py-3 text-[color:var(--color-text)] outline-none placeholder:text-[color:var(--color-muted)] focus:border-[color:var(--color-accent)]"
            />
          )}
        </div>
      ))}
    </div>
  );
}
