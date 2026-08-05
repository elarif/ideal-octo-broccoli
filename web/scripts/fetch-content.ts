import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wpClient, type WpPost, type WpMedia, type WpStation } from "../src/lib/wp-client";
import { fetchTaxonomies } from "../src/lib/fetch-taxonomies";
import { normalizeSlug } from "../src/lib/slug-normalize";

const BOOKS_OUT = join(process.cwd(), "src/content/books");
const FETCH_LIMIT = Number(process.env.FETCH_LIMIT || "500");

function extractTextUrl(content: string): string | undefined {
  const match = content.match(/href="(https?:\/\/[^"]*(?:wikisource|gutenberg|ebooks|bnf|gallica)[^"]*)"/i);
  return match?.[1];
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  nbsp: " ",
  "#8230": "…",
  "#8217": "’",
  "#8216": "‘",
  "#8220": "”",
  "#8221": "”",
  "#8211": "–",
  "#8212": "—",
  "#160": " ",
};

function decodeHtml(input: string): string {
  return input
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (_, name) => HTML_ENTITIES[name] || `&${name};`)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));
}

function normalizeTerm(t: { id: number; slug: string; name: string }) {
  return { id: t.id, slug: normalizeSlug(t.slug), name: t.name };
}

function termMap(post: WpPost, taxonomy: string): Array<{ id: number; slug: string; name: string }> {
  const groups = post._embedded?.["wp:term"] || [];
  for (const group of groups) {
    const matched = group.filter((t) => t.taxonomy === taxonomy);
    if (matched.length) return matched.map((t) => normalizeTerm({ id: t.id, slug: t.slug, name: t.name }));
  }
  return [];
}

function extractCover(post: WpPost) {
  const fm = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!fm) return undefined;
  return {
    url: fm.source_url,
    width: fm.media_details.width,
    height: fm.media_details.height,
    alt: decodeHtml(fm.alt_text || post.title.rendered),
  };
}

async function main() {
  await mkdir(BOOKS_OUT, { recursive: true });
  console.log(`→ Fetch up to ${FETCH_LIMIT} books from WordPress…`);
  const posts: WpPost[] = [];
  for await (const post of wpClient.paginatePosts()) {
    posts.push(post);
    if (posts.length % 100 === 0) console.log(`  ${posts.length} books…`);
    if (posts.length >= FETCH_LIMIT) break;
  }
  console.log(`✓ ${posts.length} books fetched`);

  // Fetch taxonomies and only scrape portraits for authors present in the built books.
  const authorSlugs = new Set<string>();
  for (const post of posts) {
    const groups = post._embedded?.["wp:term"] || [];
    for (const group of groups) {
      for (const term of group) {
        if (term.taxonomy === "auteur") authorSlugs.add(normalizeSlug(term.slug));
      }
    }
  }
  await fetchTaxonomies(join(process.cwd(), "src/content"), authorSlugs);
  console.log("→ Fetch audio tracks per book (parallel batch)…");
  const tracksByParent = new Map<number, WpMedia[]>();
  const CONCURRENCY = 20;
  for (let i = 0; i < posts.length; i += CONCURRENCY) {
    const batch = posts.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (post) => {
        const tracks = await fetchTracksForPost(post);
        tracksByParent.set(post.id, tracks);
      })
    );
    if ((i + CONCURRENCY) % 100 === 0 || i + CONCURRENCY >= posts.length) {
      console.log(`  ${Math.min(i + CONCURRENCY, posts.length)} books scanned…`);
    }
  }

  console.log("→ Write books JSON…");
  let written = 0;
  for (const post of posts) {
    const metaDurationSec = Math.round((post.meta?.duration ?? 0) / 1000);
    const tracks = (tracksByParent.get(post.id) || []).sort((a, b) =>
      (a.media_details?.menu_order ?? a.id) - (b.media_details?.menu_order ?? b.id)
    );
    const tracksDurationTotal = tracks.reduce((s, t) => s + (t.media_details?.length ?? 0), 0);
    const durationTotal = metaDurationSec || tracksDurationTotal;
    const slug = normalizeSlug(post.slug);
    const book = {
      id: post.id,
      slug,
      title: decodeHtml(post.title.rendered),
      excerpt: decodeHtml(post.excerpt.rendered.replace(/<[^>]+>/g, "").trim()),
      content: post.content.rendered,
      cover: extractCover(post),
      durationTotal,
      authors: termMap(post, "auteur"),
      voices: termMap(post, "voix"),
      genres: termMap(post, "genre_livre"),
      periods: termMap(post, "periode"),
      regions: termMap(post, "region"),
      licences: termMap(post, "licence"),
      tags: termMap(post, "post_tag"),
      tracks: tracks
        .map((m, i) => ({
          id: m.id,
          slug: normalizeSlug(m.slug),
          title: decodeHtml(m.title.rendered),
          order: m.media_details?.menu_order ?? i,
          url: m.b2_url || m.source_url || m.meta?.download_url || "",
          duration: m.media_details?.length ?? msToSec(m.meta?.duration),
          size: m.media_details?.filesize ?? 0,
        }))
        .filter((t) => t.url && t.url.startsWith("http")),
      views: post.meta?.["post-count-all"] ?? 0,
      likeCount: post.meta?.like_count ?? 0,
      commentCount: 0,
      downloadUrl: post.meta?.download_url || undefined,
      textUrl: extractTextUrl(post.content.rendered),
      publishedAt: post.date_gmt,
      modifiedAt: post.modified_gmt,
      legacyUrl: post.link,
    };
    await writeFile(join(BOOKS_OUT, `${slug}.json`), JSON.stringify(book, null, 2));
    written++;
  }
  console.log(`✓ ${written} books written to ${BOOKS_OUT}`);
}

function msToSec(ms?: number): number {
  return Math.round((ms ?? 0) / 1000);
}

function parseItemId(item: string): number | undefined {
  const match = item.match(/^\s*(\d+)\s*:/);
  return match ? Number(match[1]) : undefined;
}

async function fetchTracksForPost(post: WpPost): Promise<WpMedia[]> {
  const type = post.meta?.type ?? "single";
  const stream = post.meta?.stream;
  const downloadUrl = post.meta?.download_url;
  const items = post.meta?.items;

  if (type === "single" && (stream || downloadUrl)) {
    return [{
      id: post.id,
      slug: normalizeSlug(post.slug),
      title: { rendered: post.title.rendered },
      mime_type: "audio/mpeg",
      source_url: stream || downloadUrl || "",
      media_details: { length: msToSec(post.meta?.duration), filesize: 0, menu_order: 0 },
    }];
  }

  if (items && items.length > 0) {
    const ids = items.map(parseItemId).filter((id): id is number => id !== undefined && !Number.isNaN(id));
    if (ids.length) {
      const stations = await wpClient.getStationsByIds(ids);
      const byId = new Map(stations.map((s) => [s.id, s]));
      return ids.map((id, i) => {
        const s = byId.get(id);
        const itemLabel = items[i]?.replace(/^\s*\d+\s*:\s*/, "") || `Piste ${i + 1}`;
        const url = s?.b2_url || s?.meta?.stream || s?.meta?.download_url || "";
        const duration = msToSec(s?.meta?.duration);
        return {
          id,
          slug: normalizeSlug(s?.slug || `${post.slug}-${i + 1}`),
          title: { rendered: s?.title?.rendered || itemLabel },
          mime_type: "audio/mpeg",
          source_url: url,
          meta: { duration: s?.meta?.duration || 0, download_url: s?.meta?.download_url || "" },
          media_details: { length: duration, filesize: 0, menu_order: i },
        } as WpMedia;
      }).filter((m) => (m.source_url || m.b2_url || m.meta?.download_url || "").startsWith("http"));
    }
  }

  return wpClient.getMediaChildren(post.id);
}

main().catch((e) => { console.error(e); process.exit(1); });
