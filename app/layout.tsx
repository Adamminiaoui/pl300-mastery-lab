import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, Manrope } from "next/font/google";

import { ThemeScript } from "@/components/theme-script";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "PL-300 Exam Simulator",
  description: "Practice, exam, and full-mock simulator for the Microsoft PL-300 exam.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <ThemeScript />
        <div className="min-h-screen">
          <header className="sticky top-0 z-40 border-b border-white/8 bg-[color:var(--color-surface)]/85 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <Link href="/" className="shrink-0">
                <div className="text-xs uppercase tracking-[0.36em] text-[color:var(--color-muted)]">
                  Microsoft
                </div>
                <div className="mt-1 text-lg font-semibold text-[color:var(--color-text)]">
                  PL-300 Simulator
                </div>
              </Link>
              <nav className="ml-auto flex flex-wrap items-center gap-2 text-sm font-semibold text-[color:var(--color-muted)]">
                {[
                  ["/practice", "Practice"],
                  ["/exam", "Exam"],
                  ["/mock", "Mock"],
                  ["/review", "Review"],
                  ["/questions", "Questions"],
                ].map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-full px-4 py-2 transition hover:bg-black/8 hover:text-[color:var(--color-text)]"
                  >
                    {label}
                  </Link>
                ))}
                <ThemeToggle />
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
