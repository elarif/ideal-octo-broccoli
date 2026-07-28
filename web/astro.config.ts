import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: process.env.SITE_URL || "https://litteratureaudio.pages.dev",
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [tailwind({ applyBaseStyles: false }), sitemap()],
});
