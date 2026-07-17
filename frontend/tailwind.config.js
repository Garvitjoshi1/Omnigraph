/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { forest: "rgb(var(--forest) / <alpha-value>)", panel: "rgb(var(--panel) / <alpha-value>)", line: "rgb(var(--line) / <alpha-value>)", mint: "rgb(var(--mint) / <alpha-value>)", muted: "rgb(var(--muted) / <alpha-value>)", critical: "rgb(var(--critical) / <alpha-value>)", warning: "rgb(var(--warning) / <alpha-value>)" },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui"] },
      boxShadow: { pulse: "0 0 0 1px rgba(255,107,107,.25), 0 0 32px rgba(255,107,107,.17)" },
      keyframes: { breathe: { "0%,100%": { boxShadow: "0 0 0 1px rgba(255,107,107,.2),0 0 14px rgba(255,107,107,.1)" }, "50%": { boxShadow: "0 0 0 1px rgba(255,107,107,.75),0 0 36px rgba(255,107,107,.3)" } }, dash: { to: { strokeDashoffset: "-20" } } },
      animation: { breathe: "breathe 3s ease-in-out infinite", dash: "dash 1.7s linear infinite", live: "pulse 1.8s ease-in-out infinite" }
    }
  },
  plugins: []
};
