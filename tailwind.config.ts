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
          gold: "#C79635",
          champagne: "#E2C978",
          orange: "#9B6828",
          ember: "#704417",
          bronze: "#A8752B",
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
