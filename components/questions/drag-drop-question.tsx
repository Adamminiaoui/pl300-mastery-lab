"use client";

import { useMemo, useState } from "react";

import { shuffleArray } from "@/lib/helpers";
import type { Question, QuestionResponse } from "@/lib/types";

interface DragDropQuestionProps {
  question: Question;
  response?: QuestionResponse;
  disabled?: boolean;
  onChange: (response: QuestionResponse) => void;
}

export function DragDropQuestion({
  question,
  response,
  disabled,
  onChange,
}: DragDropQuestionProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const fields = response?.fields ?? {};

  const items = useMemo(
    () => shuffleArray(question.dragItems ?? [], question.id),
    [question.dragItems, question.id],
  );

  const assignedIds = new Set(Object.values(fields));
  const remainingItems = items.filter((item) => !assignedIds.has(item.id));

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[1.5rem] border border-white/10 bg-black/5 p-4">
        <div className="mb-3 text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
          Drag Items
        </div>
        <div className="space-y-3">
          {remainingItems.map((item) => (
            <button
              key={item.id}
              type="button"
              draggable={!disabled}
              onDragStart={() => setDraggingId(item.id)}
              onDragEnd={() => setDraggingId(null)}
              className="w-full rounded-2xl border border-white/10 bg-[color:var(--color-panel)] px-4 py-3 text-left text-sm font-medium text-[color:var(--color-text)] transition hover:border-[color:var(--color-accent)]"
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {(question.dropZones ?? []).map((zone) => {
          const assigned = items.find((item) => item.id === fields[zone.id]);
          return (
            <div
              key={zone.id}
              onDragOver={(event) => {
                if (!disabled) {
                  event.preventDefault();
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (disabled || !draggingId) {
                  return;
                }
                onChange({
                  fields: {
                    ...fields,
                    [zone.id]: draggingId,
                  },
                });
                setDraggingId(null);
              }}
              className="rounded-[1.35rem] border border-dashed border-white/15 bg-black/5 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[color:var(--color-text)]">
                  {zone.label}
                </div>
                {assigned && !disabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...fields };
                      delete next[zone.id];
                      onChange({ fields: next });
                    }}
                    className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-muted)] hover:text-[color:var(--color-accent)]"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-[color:var(--color-panel)] px-4 py-4 text-sm text-[color:var(--color-text)]">
                {assigned?.text ?? "Drop an item here"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
