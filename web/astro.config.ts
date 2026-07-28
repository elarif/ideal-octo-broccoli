import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: process.env.SITE_URL || "https://www.litteratureaudio.com",
  output: "static",
  trailingSlash: "never",
  build: { format: "directory" },
  integrations: [tailwind({ applyBaseStyles: false }), react(), sitemap()],
  vite: {
    define: {
      "process.env.LA_API_BASE": JSON.stringify(process.env.LA_API_BASE),
      "process.env.LA_IMAGE_TRANSFORM": JSON.stringify(process.env.LA_IMAGE_TRANSFORM),
    },
  },
});
