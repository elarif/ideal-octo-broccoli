import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wpClient } from "./wp-client";

const TAXONOMIES: Record<string, string> = {
  auteur: "authors",
  voix: "voices",
  genre_livre: "genres",
  periode: "periods",
  region: "regions",
  licence: "licences",
  tags: "tags",
};

export async function fetchTaxonomies(outRoot: string) {
  for (const [wpTaxonomy, dirName] of Object.entries(TAXONOMIES)) {
    const outDir = join(outRoot, dirName);
    await mkdir(outDir, { recursive: true });
    let count = 0;
    for await (const term of wpClient.paginateTerms(wpTaxonomy)) {
      const payload = {
        id: term.id,
        slug: term.slug,
        name: term.name,
        description: term.description || "",
        count: term.count || 0,
      };
      await writeFile(join(outDir, `${term.slug}.json`), JSON.stringify(payload, null, 2));
      count++;
    }
    console.log(`✓ ${count} ${dirName} written`);
  }
}
