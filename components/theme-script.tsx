export function ThemeScript() {
  const script = `
    try {
      const saved = localStorage.getItem('pl300-exam-simulator-store');
      const parsed = saved ? JSON.parse(saved) : null;
      const theme = parsed?.state?.theme ?? 'dark';
      document.documentElement.dataset.theme = theme;
    } catch (error) {
      document.documentElement.dataset.theme = 'dark';
    }
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
