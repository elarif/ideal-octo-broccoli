import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /
Sitemap: ${import.meta.env.SITE || "https://litterature.pages.dev"}/sitemap-index.xml
`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
};
