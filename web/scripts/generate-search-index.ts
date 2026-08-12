import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const BOOKS_DIR = join(process.cwd(), "src/content/books");
const OUT_FILE = join(process.cwd(), "dist/search-filters.json");

interface BookJson {
  slug: string;
  title: string;
  authors: Array<{ slug: string }>;
  voices: Array<{ slug: string }>;
  genres: Array<{ slug: string }>;
  periods: Array<{ slug: string }>;
  regions: Array<{ slug: string }>;
  licences: Array<{ slug: string }>;
  durationTotal: number;
  views: number;
}

interface FilterEntry {
  s: string;
  t: string;
  a: string[];
  v: string[];
  g: string[];
  p: string[];
  r: string[];
  l: string[];
  d: number;
  w: number;
}

async function main() {
  const files = await readdir(BOOKS_DIR);
  const entries: FilterEntry[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await readFile(join(BOOKS_DIR, file), "utf-8");
    const book: BookJson = JSON.parse(raw);
    entries.push({
      s: book.slug,
      t: book.title,
      a: book.authors.map((x) => x.slug),
      v: book.voices.map((x) => x.slug),
      g: book.genres.map((x) => x.slug),
      p: book.periods.map((x) => x.slug),
      r: book.regions.map((x) => x.slug),
      l: book.licences.map((x) => x.slug),
      d: book.durationTotal,
      w: book.views,
    });
  }

  await writeFile(OUT_FILE, JSON.stringify(entries));
  console.log(`✓ ${entries.length} entries written to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});