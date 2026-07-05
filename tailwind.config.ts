import type { Config } from "tailwindcss";

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
          ink: "#221f1b",
          charcoal: "#3b3933",
          taupe: "#8d8173",
          linen: "#f7f2ea",
          paper: "#fffaf3",
          clay: "#b97155",
          moss: "#687461",
          brass: "#b08a4c"
        }
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 18px 60px rgba(59, 57, 51, 0.11)"
      }
    }
  },
  plugins: []
};

export default config;
