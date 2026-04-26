import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        ink: {
          950: "#07090d",
          900: "#0b0e14",
          850: "#0f1320",
          800: "#131826",
          700: "#1b2030",
          600: "#262c3d",
          500: "#3a4255",
        },
        accent: {
          DEFAULT: "#7c5cff",
          glow: "#a48bff",
        },
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.4s ease-in-out infinite",
        slideIn: "slideIn 120ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
