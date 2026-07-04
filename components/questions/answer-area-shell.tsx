import type { ReactNode } from "react";

interface AnswerAreaShellProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export function AnswerAreaShell({
  title = "Answer Area",
  subtitle,
  children,
}: AnswerAreaShellProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-[color:var(--color-panel)] p-6">
      <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]">
        {title}
      </div>
      {subtitle ? (
        <div className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">{subtitle}</div>
      ) : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
