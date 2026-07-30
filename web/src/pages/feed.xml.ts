import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const GET: APIRoute = async () => {
  const site = import.meta.env.SITE || "https://litteratureaudio.pages.dev";
  const allBooks = await getCollection("books");
  const books = [...allBooks]
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())
    .slice(0, 50);

  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const items = books.map((book) => {
    const d = book.data;
    const url = `${site}/livre-audio-gratuit-mp3/${d.slug}.html`;
    const firstTrack = d.tracks[0];
    const enclosure = firstTrack
      ? `<enclosure url="${escapeXml(firstTrack.url)}" length="${firstTrack.size || 0}" type="audio/mpeg" />`
      : "";
    return `
      <item>
        <title>${escapeXml(d.title)}</title>
        <link>${url}</link>
        <guid>${url}</guid>
        <pubDate>${d.publishedAt.toUTCString()}</pubDate>
        <description>${escapeXml(d.excerpt || `Livre audio gratuit ${d.title}`)}</description>
        ${enclosure}
        <itunes:duration>${Math.ceil(d.durationTotal / 60)}</itunes:duration>
      </item>
    `;
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Litteratureaudio.com</title>
    <link>${site}</link>
    <description>La référence du livre audio gratuit francophone : plus de 9000 livres audio à écouter et télécharger gratuitement au format MP3 !</description>
    <language>fr-FR</language>
    ${items.join("\n")}
  </channel>
</rss>`;

  return new Response(body, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
};
