import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wpClient, type WpPost, type WpMedia } from "../src/lib/wp-client";

const OUT = join(process.cwd(), "src/content/books");
const FETCH_LIMIT = Number(process.env.FETCH_LIMIT || "500");

function termMap(post: WpPost, taxonomy: string): Array<{ id: number; slug: string; name: string }> {
  const groups = post._embedded?.["wp:term"] || [];
  for (const group of groups) {
    const matched = group.filter((t) => t.taxonomy === taxonomy);
    if (matched.length) return matched.map((t) => ({ id: t.id, slug: t.slug, name: t.name }));
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
    alt: fm.alt_text || post.title.rendered,
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`→ Fetch up to ${FETCH_LIMIT} books from WordPress…`);
  const posts: WpPost[] = [];
  for await (const post of wpClient.paginatePosts()) {
    posts.push(post);
    if (posts.length % 100 === 0) console.log(`  ${posts.length} books…`);
    if (posts.length >= FETCH_LIMIT) break;
  }
  console.log(`✓ ${posts.length} books fetched`);

  console.log("→ Fetch audio tracks per book (parallel batch)…");
  const tracksByParent = new Map<number, WpMedia[]>();
  const CONCURRENCY = 20;
  for (let i = 0; i < posts.length; i += CONCURRENCY) {
    const batch = posts.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (post) => {
        const tracks = await wpClient.getMediaChildren(post.id);
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
    const tracks = (tracksByParent.get(post.id) || []).sort((a, b) =>
      (a.media_details?.menu_order ?? a.id) - (b.media_details?.menu_order ?? b.id)
    );
    const durationTotal = tracks.reduce((s, t) => s + (t.media_details?.length || 0), 0);
    const book = {
      id: post.id,
      slug: post.slug,
      title: post.title.rendered,
      excerpt: post.excerpt.rendered.replace(/<[^>]+>/g, "").trim(),
      content: post.content.rendered,
      cover: extractCover(post),
      durationTotal,
      authors: termMap(post, "auteur"),
      voices: termMap(post, "voix"),
      genres: termMap(post, "genre_livre"),
      tracks: tracks.map((m, i) => ({
        id: m.id,
        slug: m.slug,
        title: m.title.rendered,
        order: m.media_details?.menu_order ?? i,
        url: m.source_url,
        duration: m.media_details?.length ?? 0,
        size: m.media_details?.filesize ?? 0,
      })),
      views: 0,
      publishedAt: post.date_gmt,
      modifiedAt: post.modified_gmt,
      legacyUrl: post.link,
    };
    await writeFile(join(OUT, `${post.slug}.json`), JSON.stringify(book, null, 2));
    written++;
  }
  console.log(`✓ ${written} books written to ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
