import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wpClient } from "./wp-client";
import { normalizeSlug } from "./slug-normalize";

const TAXONOMIES: Record<string, string> = {
  auteur: "authors",
  voix: "voices",
  genre_livre: "genres",
  periode: "periods",
  region: "regions",
  licence: "licences",
  tags: "tags",
};

function extractPortrait(html: string, name: string): { url: string; alt: string } | undefined {
  const re = /<img[^\u003e]+src="([^"]+)"[^\u003e]*alt="([^"]*)"[^\u003e]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const [, url, alt] = match;
    const lowAlt = alt.toLowerCase();
    const lowUrl = url.toLowerCase();
    if (
      (lowAlt.includes(name.toLowerCase()) && /portrait|photo|gravure|illustration|par/.test(lowAlt)) ||
      /portrait/.test(lowUrl)
    ) {
      return { url, alt };
    }
  }
  return undefined;
}

async function fetchAuthorPortrait(slug: string, name: string): Promise<{ url: string; alt: string } | undefined> {
  try {
    const url = `https://www.litteratureaudio.com/livre-audio-gratuit-mp3/auteur/${slug}`;
    const resp = await fetch(url, { headers: { accept: "text/html" } });
    if (!resp.ok) return undefined;
    const html = await resp.text();
    return extractPortrait(html, name);
  } catch {
    return undefined;
  }
}

export async function fetchTaxonomies(outRoot: string, authorSlugs?: Set<string>) {
  for (const [wpTaxonomy, dirName] of Object.entries(TAXONOMIES)) {
    const outDir = join(outRoot, dirName);
    await mkdir(outDir, { recursive: true });
    const terms: Array<{ id: number; slug: string; name: string; description?: string; count?: number }> = [];
    for await (const term of wpClient.paginateTerms(wpTaxonomy)) {
      terms.push(term);
    }

    let portraits: Map<string, { url: string; alt: string }> = new Map();
    if (wpTaxonomy === "auteur") {
      const termsToPortrait = authorSlugs
        ? terms.filter((term) => authorSlugs.has(normalizeSlug(term.slug)))
        : terms.slice(0, 300);
      console.log(`→ Fetching ${termsToPortrait.length} author portraits in parallel batches…`);
      const CONCURRENCY = 20;
      for (let i = 0; i < termsToPortrait.length; i += CONCURRENCY) {
        const batch = termsToPortrait.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (term) => {
            const slug = normalizeSlug(term.slug);
            const portrait = await fetchAuthorPortrait(slug, term.name);
            return { slug, portrait };
          })
        );
        for (const { slug, portrait } of results) {
          if (portrait) portraits.set(slug, portrait);
        }
        if ((i + CONCURRENCY) % 100 === 0 || i + CONCURRENCY >= termsToPortrait.length) {
          console.log(`  ${Math.min(i + CONCURRENCY, termsToPortrait.length)} portraits fetched…`);
        }
      }
    }

    let count = 0;
    for (const term of terms) {
      const slug = normalizeSlug(term.slug);
      const payload: Record<string, unknown> = {
        id: term.id,
        slug,
        name: term.name,
        description: term.description || "",
        count: term.count || 0,
      };
      if (wpTaxonomy === "auteur") {
        const portrait = portraits.get(slug);
        if (portrait) payload.portrait = portrait;
      }
      await writeFile(join(outDir, `${slug}.json`), JSON.stringify(payload, null, 2));
      count++;
    }
    console.log(`✓ ${count} ${dirName} written`);
  }
}
