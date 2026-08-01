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

export async function fetchTaxonomies(outRoot: string) {
  for (const [wpTaxonomy, dirName] of Object.entries(TAXONOMIES)) {
    const outDir = join(outRoot, dirName);
    await mkdir(outDir, { recursive: true });
    let count = 0;
    for await (const term of wpClient.paginateTerms(wpTaxonomy)) {
      const slug = normalizeSlug(term.slug);
      const payload: Record<string, unknown> = {
        id: term.id,
        slug,
        name: term.name,
        description: term.description || "",
        count: term.count || 0,
      };
      if (wpTaxonomy === "auteur") {
        const portrait = await fetchAuthorPortrait(slug, term.name);
        if (portrait) payload.portrait = portrait;
      }
      await writeFile(join(outDir, `${slug}.json`), JSON.stringify(payload, null, 2));
      count++;
    }
    console.log(`✓ ${count} ${dirName} written`);
  }
}
