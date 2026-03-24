/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0b111d",
        panel: "#121b2d",
        panelAlt: "#0f1829",
        accent: "#22d3ee",
        accent2: "#f59e0b",
        ok: "#34d399",
        warn: "#fb7185"
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"]
      },
      keyframes: {
        drift: {
          "0%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
          "100%": { transform: "translateY(0px)" }
        },
        pulseLine: {
          "0%": { opacity: "0.25" },
          "50%": { opacity: "1" },
          "100%": { opacity: "0.25" }
        }
      },
      animation: {
        drift: "drift 5s ease-in-out infinite",
        pulseLine: "pulseLine 2.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
