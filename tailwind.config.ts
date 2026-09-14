import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/*
  monopo saigon tokens. Two rules are enforced here rather than left to
  discipline: there is no shadow scale, and there is no border radius
  between 0px and the 75px pill.
*/
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    // Replaced wholesale — a chromatic utility should not be reachable.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      obsidian: "#000000",
      paper: "#ffffff",
      inkstone: "#181818",
      "felt-gray": "#6d6d6d",
      "slate-pill": "#636363",
      "ash-mist": "#9a9a9a",
      pewter: "#808080",
    },
    boxShadow: {
      none: "none",
    },
    borderRadius: {
      none: "0px",
      DEFAULT: "0px",
      sm: "0px",
      md: "0px",
      lg: "0px",
      xl: "0px",
      pill: "75px",
      full: "9999px",
    },
    extend: {
      fontFamily: {
        roobert: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        raleway: ["Raleway", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontWeight: {
        light: "300",
        normal: "400",
        semibold: "600",
      },
      fontSize: {
        label: ["11px", { lineHeight: "1.36", letterSpacing: "0.08em" }],
        caption: ["12px", { lineHeight: "1.19" }],
        "body-sm": ["16px", { lineHeight: "1.15" }],
        body: ["18px", { lineHeight: "1.21" }],
      },
      // Tailwind's default scale is already 4px-based, so it IS the system's
      // scale. Only the three steps it lacks are added — overriding existing
      // keys would silently change every default utility.
      spacing: {
        "11.5": "46px", // --section-gap
        "17": "68px",
        "38": "152px",
      },
      maxWidth: {
        page: "1078px",
      },
      transitionTimingFunction: {
        monopo: "cubic-bezier(0.19, 1, 0.22, 1)",
      },
      transitionDuration: {
        micro: "400ms",
        move: "800ms",
        glide: "1250ms",
      },
      keyframes: {
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "spin-slow": "spin-slow 18s linear infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
