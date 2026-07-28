import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{astro,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: { primary: "#466cde" },
    },
  },
  plugins: [],
} satisfies Config;
