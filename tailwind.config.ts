import type { Config } from "tailwindcss";

// Brand tokens are gospel per brand-guidelines.html (V1.0, 2026):
// two warm neutral families + brass as the only accent, pine for statement
// fields, and a shared hairline. No pure white, no pure black, no shadows,
// no rounded corners anywhere in the system.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        atelier: {
          paper: "#FAF8F4",
          ivory: "#F5F1EA",
          sand: "#D9CFC0",
          taupe: "#B8A99A",
          ink: "#1E1B17",
          charcoal: "#171512",
          brass: "#A5824B",
          pine: "#23403C",
          umber: "#5A5348",
          fawn: "#8A8073",
          clay: "#B06A52"
        },
        hairline: "rgba(30, 27, 23, 0.18)",
        "hairline-light": "rgba(245, 241, 234, 0.25)"
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      letterSpacing: {
        label: "0.16em",
        eyebrow: "0.18em",
        wide2: "0.22em",
        wm: "0.34em"
      }
    }
  },
  plugins: []
};

export default config;
