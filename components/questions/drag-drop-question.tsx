"use client";

import { useMemo } from "react";

import type { Question, QuestionResponse } from "@/lib/types";
import { AnswerAreaShell } from "@/components/questions/answer-area-shell";
import { ExamSelect } from "@/components/questions/exam-select";

interface DragDropQuestionProps {
  question: Question;
  response?: QuestionResponse;
  disabled?: boolean;
  revealAnswer?: boolean;
  onChange: (response: QuestionResponse) => void;
}

export function DragDropQuestion({
  question,
  response,
  disabled,
  revealAnswer,
  onChange,
}: DragDropQuestionProps) {
  const fields = response?.fields ?? {};

  const options = useMemo(
    () => (question.dragItems ?? []).map((item) => ({ value: item.id, label: item.text })),
    [question.dragItems],
  );

  return (
    <AnswerAreaShell subtitle="Choose a value for each target in the answer area.">
      <div className="rounded-[1.25rem] border border-white/10 bg-black/5 p-4">
        <div className="mb-3 text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
          Answer Choices
        </div>
        <div className="flex flex-wrap gap-3">
          {options.map((option) => (
            <div
              key={option.value}
              className="rounded-full border border-white/10 bg-[color:var(--color-panel)] px-4 py-2 text-sm font-medium text-[color:var(--color-text)]"
            >
              {option.label}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {(question.dropZones ?? []).map((zone) => {
          const value = fields[zone.id] ?? "";
          const isCorrect = value === zone.correctItemId;
          const tone = revealAnswer ? (isCorrect ? "correct" : "incorrect") : "default";
          const wrapperClass =
            tone === "correct"
              ? "border-emerald-500/30 bg-emerald-500/8"
              : tone === "incorrect"
                ? "border-rose-500/30 bg-rose-500/8"
                : "border-white/10 bg-black/5";

          return (
            <div
              key={zone.id}
              className={`grid gap-4 rounded-[1.1rem] border px-4 py-4 md:grid-cols-[minmax(0,1fr)_22rem] md:items-center ${wrapperClass}`}
            >
              <div className="text-base font-semibold text-[color:var(--color-text)]">
                {zone.label}
              </div>
              <ExamSelect
                value={value}
                tone={tone}
                disabled={disabled}
                options={options}
                placeholder="Choose an answer"
                onChange={(nextValue) =>
                  onChange({
                    fields: {
                      ...fields,
                      [zone.id]: nextValue,
                    },
                  })
                }
              />
            </div>
          );
        })}
      </div>
    </AnswerAreaShell>
  );
}
