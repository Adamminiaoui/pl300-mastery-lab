"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface ExamSelectOption {
  value: string;
  label: string;
}

interface ExamSelectProps {
  value?: string;
  options: ExamSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  tone?: "default" | "correct" | "incorrect";
  onChange: (value: string) => void;
}

export function ExamSelect({
  value,
  options,
  placeholder = "Select an answer",
  disabled,
  tone = "default",
  onChange,
}: ExamSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const selected = options.find((option) => option.value === value);
  const toneClass =
    tone === "correct"
      ? "border-emerald-500/70 bg-white text-[#111827] shadow-[0_0_0_1px_rgba(16,185,129,0.18)]"
      : tone === "incorrect"
        ? "border-rose-500/70 bg-white text-[#111827] shadow-[0_0_0_1px_rgba(244,63,94,0.18)]"
        : "border-[#1c1c1c]/35 bg-white text-[#111827] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`flex min-h-13 w-full items-center justify-between rounded-md border px-4 py-2 text-left text-base transition hover:border-[#1c1c1c]/60 disabled:cursor-not-allowed disabled:bg-[#f4f4f4] ${toneClass}`}
      >
        <span className={selected ? "" : "text-[#667085]"}>
          {selected?.label ?? value ?? placeholder}
        </span>
        <span className="ml-4 text-sm text-current">v</span>
      </button>

      {open ? (
        <div
          id={listId}
          className="absolute z-30 mt-2 w-full rounded-md border border-[#1c1c1c]/25 bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.18)]"
        >
          {options.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`block w-full rounded-sm px-3 py-2 text-left text-base text-[#111827] transition hover:bg-[#eef2f7] ${
                    option.value === value ? "bg-[#e5ecf6]" : ""
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-[#667085]">
              No answer choices are available for this item yet.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
