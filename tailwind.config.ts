import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          950: "rgb(var(--ink-950, 5 6 10) / <alpha-value>)",
          900: "rgb(var(--ink-900, 10 12 18) / <alpha-value>)",
          850: "rgb(var(--ink-850, 14 17 25) / <alpha-value>)",
          800: "rgb(var(--ink-800, 19 23 36) / <alpha-value>)",
          700: "rgb(var(--ink-700, 26 31 48) / <alpha-value>)",
          600: "rgb(var(--ink-600, 37 43 64) / <alpha-value>)",
          500: "rgb(var(--ink-500, 54 61 86) / <alpha-value>)",
          400: "rgb(var(--ink-400, 91 99 128) / <alpha-value>)",
          300: "rgb(var(--ink-300, 140 147 175) / <alpha-value>)",
          200: "rgb(var(--ink-200, 188 193 212) / <alpha-value>)",
          100: "rgb(var(--ink-100, 231 234 242) / <alpha-value>)",
        },
        accent: {
          gold: "rgb(var(--primary-gold, 199 150 53) / <alpha-value>)",
          champagne: "rgb(var(--champagne-highlight, 226 201 120) / <alpha-value>)",
          orange: "rgb(var(--burnt-gold, 155 104 40) / <alpha-value>)",
          ember: "rgb(var(--accent-ember, 112 68 23) / <alpha-value>)",
          bronze: "rgb(var(--accent-bronze, 168 117 43) / <alpha-value>)",
        },
        status: {
          ok: "#22c55e",
          warn: "#D49A3A",
          err: "#ef4444",
          info: "#38bdf8",
          off: "#6b7280",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.045) inset, 0 14px 44px -26px rgba(0,0,0,0.86)",
        glow: "0 0 0 1px rgba(226,201,120,0.24), 0 10px 36px -14px rgba(155,104,40,0.32)",
        "glow-sm": "0 0 0 1px rgba(226,201,120,0.16), 0 6px 20px -12px rgba(155,104,40,0.28)",
        glass:
          "0 1px 0 0 rgba(255,255,255,0.055) inset, 0 0 0 1px rgba(226,201,120,0.08), 0 18px 54px -28px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        "grid-lines":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        "ember-radial":
          "radial-gradient(60% 60% at 30% 20%, rgba(155,104,40,0.16) 0%, rgba(155,104,40,0) 60%), radial-gradient(80% 80% at 80% 80%, rgba(226,201,120,0.08) 0%, rgba(226,201,120,0) 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
