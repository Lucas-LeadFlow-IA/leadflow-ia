import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // keep in sync with the CSS variables in app/globals.css (used by charts)
        bg: "#07090d",
        surface: "#0f141b",
        raised: "#151c26",
        line: "#1f2937",
        ink: "#e8edf3",
        muted: "#9aa7b8",
        faint: "#64748b",
        accent: "#f7931a",
        good: "#0ca30c",
        warn: "#fab219",
        bad: "#d03b3b",
        info: "#3987e5",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: { card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.35)" },
    },
  },
  plugins: [],
};
export default config;
