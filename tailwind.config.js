import {heroui} from "@heroui/theme"
import typography from "@tailwindcss/typography"

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      animation: {
        "gradient-rotate": "gradient-rotate 3s linear infinite",
        "shimmer": "shimmer 1s ease-in-out infinite",
      },
      keyframes: {
        "gradient-rotate": {
          "0%": { "--gradient-angle": "0deg" },
          "100%": { "--gradient-angle": "360deg" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  darkMode: "class",
  plugins: [typography, heroui()],
}

module.exports = config;