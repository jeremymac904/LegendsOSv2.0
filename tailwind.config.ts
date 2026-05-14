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
          950: "#05060a",
          900: "#0a0c12",
          850: "#0e1119",
          800: "#131724",
          700: "#1a1f30",
          600: "#252b40",
          500: "#363d56",
          400: "#5b6380",
          300: "#8c93af",
          200: "#bcc1d4",
          100: "#e7eaf2",
        },
        accent: {
          gold: "#f5b400",
          orange: "#ff8a1f",
          ember: "#ff5722",
        },
        status: {
          ok: "#22c55e",
          warn: "#f59e0b",
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
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.7)",
        glow: "0 0 0 1px rgba(245,180,0,0.35), 0 8px 32px -8px rgba(255,138,31,0.35)",
        "glow-sm": "0 0 0 1px rgba(245,180,0,0.22), 0 4px 18px -8px rgba(255,138,31,0.28)",
        glass:
          "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 0 0 1px rgba(245,180,0,0.06), 0 12px 36px -18px rgba(0,0,0,0.85)",
      },
      backgroundImage: {
        "grid-lines":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        "ember-radial":
          "radial-gradient(60% 60% at 30% 20%, rgba(255,138,31,0.18) 0%, rgba(255,138,31,0) 60%), radial-gradient(80% 80% at 80% 80%, rgba(245,180,0,0.08) 0%, rgba(245,180,0,0) 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
