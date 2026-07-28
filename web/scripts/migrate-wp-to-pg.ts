import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wpClient } from "../src/lib/wp-client";
import type { WpPost } from "./lib/wp-types";

const dryRun = process.argv.includes("--dry-run");
const OUT = join(process.cwd(), "tmp/migration-report.json");

function termMap(post: WpPost, taxonomy: string) {
  const groups = post._embedded?.["wp:term"] || [];
  for (const group of groups) {
    const matched = group.filter((t) => t.taxonomy === taxonomy);
    if (matched.length) return matched.map((t) => ({ id: t.id, slug: t.slug, name: t.name }));
  }
  return [];
}

function singleTerm(post: WpPost, taxonomy: string) {
  return termMap(post, taxonomy)[0];
}

const CONCURRENCY = 10;

async function main() {
  console.log(`Mode ${dryRun ? "dry-run" : "apply"}`);
  let bookCount = 0;
  let trackCount = 0;
  let missingTracks = 0;

  const buffer: WpPost[] = [];

  async function flush() {
    const results = await Promise.all(
      buffer.map((post) => wpClient.getMediaChildren(post.id))
    );
    for (const tracks of results) {
      trackCount += tracks.length;
      if (tracks.length === 0) missingTracks++;
    }
    buffer.length = 0;
  }

  for await (const post of wpClient.paginatePosts()) {
    bookCount++;
    buffer.push(post);
    if (buffer.length >= CONCURRENCY) await flush();
    if (bookCount % 100 === 0) console.log(`  ${bookCount} livres scannés…`);
  }

  if (buffer.length > 0) await flush();

  const report = {
    bookCount,
    trackCount,
    missingTracks,
    authors: (await wpClient.listTerms("auteur")).length,
    voices: (await wpClient.listTerms("voix")).length,
    genres: (await wpClient.listTerms("genre_livre")).length,
  };

  await mkdir(join(OUT, ".."), { recursive: true });
  await writeFile(OUT, JSON.stringify(report, null, 2));
  console.log("Rapport :", report);

  if (!dryRun) {
    console.log("Apply non implémenté dans cette tâche — utiliser la migration complète Couche 2.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
