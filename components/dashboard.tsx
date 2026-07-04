"use client";

import Link from "next/link";

import { ModeSelector } from "@/components/mode-selector";
import { questionStats } from "@/lib/questions";
import { useQuizStore } from "@/store/quiz-store";

export function Dashboard() {
  const progress = useQuizStore((state) => state.questionProgress);
  const examHistory = useQuizStore((state) => state.examHistory);

  const attempted = Object.keys(progress).length;
  const incorrectCount = Object.values(progress).filter(
    (item) => item.lastOutcome === "incorrect",
  ).length;
  const bestExamScore = examHistory.length
    ? Math.max(...examHistory.map((entry) => entry.scaledScore))
    : 0;
  const lastExamScore = examHistory[0]?.scaledScore ?? 0;

  return (
    <div className="space-y-8">
      <section className="rounded-[2.4rem] border border-white/10 bg-[color:var(--color-panel)]/90 p-8 shadow-[0_35px_90px_rgba(15,23,42,0.22)]">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.32em] text-[color:var(--color-muted)]">
              PL-300 Exam Practice
            </div>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight text-[color:var(--color-text)]">
              Certification-style practice built from the full 301-question source PDF.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[color:var(--color-muted)]">
              Practice by range, run timed 60-question exams, or work through the full mock while your progress stays persisted locally.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/practice"
                className="rounded-full bg-[color:var(--color-accent)] px-6 py-3 text-sm font-semibold text-white"
              >
                Start practice
              </Link>
              <Link
                href="/questions"
                className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-[color:var(--color-text)]"
              >
                Browse all questions
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            {[
              { label: "Total questions", value: questionStats.total },
              { label: "Practice progress", value: `${attempted}/${questionStats.total}` },
              { label: "Best exam score", value: `${bestExamScore}/1000` },
              { label: "Last exam score", value: `${lastExamScore}/1000` },
              { label: "Incorrect questions", value: incorrectCount },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-[1.7rem] border border-white/10 bg-black/8 p-5"
              >
                <div className="text-xs uppercase tracking-[0.26em] text-[color:var(--color-muted)]">
                  {stat.label}
                </div>
                <div className="mt-3 text-3xl font-semibold text-[color:var(--color-text)]">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ModeSelector />
    </div>
  );
}
