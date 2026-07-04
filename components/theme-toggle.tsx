"use client";

import { useEffect } from "react";

import { useQuizStore } from "@/store/quiz-store";

export function ThemeToggle() {
  const theme = useQuizStore((state) => state.theme);
  const setTheme = useQuizStore((state) => state.setTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-full border border-white/12 bg-black/10 px-4 py-2 text-sm font-semibold text-[color:var(--color-text)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
    >
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
