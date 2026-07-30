import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
  const site = import.meta.env.SITE || "https://litteratureaudio.pages.dev";
  const body = `User-agent: *
Allow: /
Sitemap: ${site}/sitemap-index.xml
`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
};
