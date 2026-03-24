import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        charcoal: "#0D0B09",
        parchment: "#F5F0E8",
        brass: "#B8935A",
        terracotta: "#C4674A",
        fig: "#4A2E35",
        "warm-ivory": "#F5F0E8",
      },
      fontFamily: {
        cormorant: ["var(--font-cormorant)", "Georgia", "serif"],
        geist: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["clamp(2.5rem,5vw,4rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(2rem,4vw,3rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        "display-sm": ["clamp(1.5rem,3vw,2.25rem)", { lineHeight: "1.2" }],
        "body-lg": ["1.125rem", { lineHeight: "1.7" }],
        "body-md": ["1rem", { lineHeight: "1.65" }],
        "body-sm": ["0.9375rem", { lineHeight: "1.6" }],
        "label": ["0.8125rem", { lineHeight: "1.5", letterSpacing: "0.05em" }],
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "30": "7.5rem",
      },
      transitionDuration: {
        "cinematic": "800ms",
        "slow": "700ms",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
