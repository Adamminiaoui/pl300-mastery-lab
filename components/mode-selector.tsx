import Link from "next/link";

const modes = [
  {
    href: "/practice",
    title: "Practice Mode",
    description: "Pick a range or only your incorrect questions and reveal answers immediately.",
  },
  {
    href: "/exam",
    title: "Exam Mode",
    description: "Run a timed 60-question exam with Microsoft-style scaled scoring.",
  },
  {
    href: "/mock",
    title: "Full Mock",
    description: "Work through all 301 questions with save and resume support.",
  },
];

export function ModeSelector() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {modes.map((mode) => (
        <Link
          key={mode.href}
          href={mode.href}
          className="group rounded-[2rem] border border-white/10 bg-[color:var(--color-panel)]/85 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.18)] transition hover:-translate-y-1 hover:border-[color:var(--color-accent)]"
        >
          <div className="mb-3 text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
            Start
          </div>
          <h3 className="text-2xl font-semibold text-[color:var(--color-text)]">{mode.title}</h3>
          <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">{mode.description}</p>
          <div className="mt-6 text-sm font-semibold text-[color:var(--color-accent)]">
            Open mode
          </div>
        </Link>
      ))}
    </div>
  );
}
