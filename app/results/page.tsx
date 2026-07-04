import { ResultsView } from "@/components/results-view";

interface ResultsPageProps {
  searchParams?: Promise<{ mode?: string }>;
}

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const params = (await searchParams) ?? {};
  const mode = params.mode === "mock" ? "mock" : "exam";
  return <ResultsView mode={mode} />;
}
