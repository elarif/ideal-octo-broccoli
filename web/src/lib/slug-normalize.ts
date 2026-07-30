/**
 * Normalize a WordPress slug so the filename and the JSON `slug` field match
 * exactly, and also match the slug used by Astro `getStaticPaths` routes.
 *
 * 1. Percent-decode any already-encoded characters.
 * 2. Strip leading/trailing whitespace.
 * 3. Lowercase.
 * 4. Collapse runs of non-alphanumeric characters (keep letters, numbers, and
 *    hyphens) into single hyphens.
 * 5. Remove leading/trailing hyphens.
 *
 * This prevents mismatches like `s%c3%b8ren-kierkegaard.json` vs the decoded
 * Astro route param `søren-kierkegaard`.
 */
export function normalizeSlug(input: string): string {
  let slug = input;

  // 1. Decode percent-encoded characters (e.g. %C3%B8 -> ø).
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // If decoding fails, keep the original string.
  }

  return slug
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
