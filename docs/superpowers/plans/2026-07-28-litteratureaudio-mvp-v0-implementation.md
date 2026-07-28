# MVP V0 — Litteratureaudio.com front statique Astro sur Cloudflare Pages

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. This plan is intentionally short so the team can iterate quickly.

**Goal:** Avoir un site Astro statique déployable gratuitement sur Cloudflare Pages, avec une home et une fiche livre, alimenté par l'API REST publique de WordPress.

**Architecture:** Astro 5 pré-rend des pages HTML statiques au build. Un script Node (`tsx`) interroge l'API REST publique de WordPress au build, écrit des fichiers JSON dans `src/content/books/`, et Astro génère la home et les ~10 000 fiches livre. Le site est déployé sur Cloudflare Pages via GitHub.

**Tech Stack:**
- Astro 5 + Tailwind CSS 3
- TypeScript 5 strict
- `tsx` pour les scripts Node
- WordPress REST API publique comme source de vérité
- Cloudflare Pages pour l'hébergement (gratuit)

## Global Constraints

- **Langue** : français (fr-FR).
- **URLs** : fiches livre identiques à WordPress (`/livre-audio-gratuit-mp3/<slug>.html`).
- **SEO de base** : title, meta description, canonical, OpenGraph.
- **Polices** : système uniquement.
- **Images** : URLs d'origine WP, attributs `width`/`height` systématiques, `loading="lazy"` sauf LCP.
- **Node** ≥ 20.11, **pnpm** ≥ 9.
- **Coût** : uniquement des services gratuits pour V0.

## File Structure

```
litteratureaudio/
├── docs/
│   └── superpowers/
│       ├── specs/2026-07-28-litteratureaudio-mvp-v0-design.md
│       └── plans/2026-07-28-litteratureaudio-mvp-v0-implementation.md
├── web/
│   ├── src/
│   │   ├── content/
│   │   │   ├── config.ts
│   │   │   └── books/            # généré au build, gitignored
│   │   ├── lib/
│   │   │   ├── env.ts
│   │   │   ├── wp-client.ts
│   │   │   ├── format-duration.ts
│   │   │   └── image-url.ts
│   │   ├── components/
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   ├── BookCard.astro
│   │   │   └── Picture.astro
│   │   ├── layouts/
│   │   │   └── Base.astro
│   │   └── pages/
│   │       ├── index.astro
│   │       ├── livre-audio-gratuit-mp3/[slug].astro
│   │       ├── 404.astro
│   │       └── robots.txt.ts
│   ├── scripts/
│   │   └── fetch-content.ts
│   ├── public/
│   │   └── favicon.ico
│   ├── astro.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── .gitignore
│   └── README.md
├── package.json           # racine
├── pnpm-workspace.yaml    # racine
└── .gitignore             # racine
```

---

## Task 1 : Nettoyer et scaffold Astro V0

**Files:**
- Modify : `package.json` racine
- Modify : `pnpm-workspace.yaml` racine
- Modify : `.gitignore` racine
- Create : `web/package.json`
- Create : `web/astro.config.ts`
- Create : `web/tailwind.config.ts`
- Create : `web/tsconfig.json`
- Create : `web/.gitignore`
- Create : `web/src/styles/global.css`
- Create : `web/README.md`
- Create : `web/public/favicon.ico` (placeholder vide)

**Interfaces:**
- Produces : `pnpm install` fonctionne à la racine et dans `web/`
- Produces : `cd web && pnpm astro build` génère `dist/`

- [ ] **Step 1 : Nettoyer les anciens packages non MVP**

Supprimer les répertoires obsolètes pour repartir propre :

```bash
rm -rf api-cache api
```

- [ ] **Step 2 : Mettre à jour la racine**

`package.json` racine :

```json
{
  "name": "litteratureaudio",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.6.0",
  "workspaces": ["web"]
}
```

`pnpm-workspace.yaml` racine :

```yaml
packages:
  - "web"
```

`.gitignore` racine (ajouter si absent) :

```
node_modules/
dist/
.DS_Store
.env
.env.local
.superpowers/
tmp/
```

- [ ] **Step 3 : Créer `web/package.json`**

```json
{
  "name": "@la/web",
  "private": true,
  "type": "module",
  "scripts": {
    "fetch:content": "tsx scripts/fetch-content.ts",
    "prebuild": "pnpm fetch:content",
    "build": "astro build",
    "dev": "astro dev",
    "check": "astro check"
  },
  "dependencies": {
    "@astrojs/sitemap": "^3.1.0",
    "@astrojs/tailwind": "^5.1.0",
    "astro": "^4.12.0",
    "tailwindcss": "^3.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 4 : Créer `web/astro.config.ts`**

```typescript
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: process.env.SITE_URL || "https://litterature.pages.dev",
  output: "static",
  trailingSlash: "never",
  build: { format: "directory" },
  integrations: [tailwind({ applyBaseStyles: false }), sitemap()],
});
```

- [ ] **Step 5 : Créer `web/tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{astro,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: { primary: "#466cde" },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 6 : Créer `web/tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@lib/*": ["src/lib/*"],
      "@components/*": ["src/components/*"]
    }
  },
  "include": ["src/**/*", "scripts/**/*", "*.config.ts"]
}
```

- [ ] **Step 7 : Créer `web/src/styles/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { color-scheme: light; }
  body { @apply font-sans antialiased bg-white text-gray-900; }
}
```

- [ ] **Step 8 : Créer `web/.gitignore`**

```
node_modules/
dist/
.astro/
.env
.env.local
src/content/books/
src/content/authors/
src/content/voices/
src/content/genres/
tmp/
```

- [ ] **Step 9 : Créer `web/README.md`**

```markdown
# Litteratureaudio.com — MVP V0

Front statique Astro alimenté par l'API REST publique de WordPress.

## Développement

```bash
pnpm install
cd web
pnpm dev
```

## Build

```bash
cd web
pnpm build
```

Le build lance `fetch-content.ts` qui récupère les livres depuis l'API WordPress.
```

- [ ] **Step 10 : Créer un favicon placeholder**

```bash
touch web/public/favicon.ico
```

- [ ] **Step 11 : Installer et vérifier le build minimal**

```bash
pnpm install
cd web
pnpm exec astro build
```

Expected : `dist/index.html` généré sans erreur (la home n'existe pas encore mais Astro crée un site vide valide).

- [ ] **Step 12 : Commit**

```bash
git add -A
git commit -m "feat(web): scaffold Astro V0 minimal (MVP Cloudflare Pages)"
```

---

## Task 2 : Client WordPress + script fetch-content

**Files:**
- Create : `web/src/lib/env.ts`
- Create : `web/src/lib/wp-client.ts`
- Create : `web/scripts/fetch-content.ts`

**Interfaces:**
- Produces : `wpClient.paginatePosts()` → `AsyncGenerator<WpPost>`
- Produces : `wpClient.getMediaChildren(postId: number)` → `Promise<WpMedia[]>`
- Produces : `pnpm fetch:content` → écrit `src/content/books/*.json`

- [ ] **Step 1 : Créer `web/src/lib/env.ts`**

```typescript
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env var ${name} manquante`);
  return v;
}

export const env = {
  wpApiBase: required("WP_API_BASE"),
  siteUrl: process.env.SITE_URL || "https://litterature.pages.dev",
};
```

- [ ] **Step 2 : Créer `web/src/lib/wp-client.ts`**

```typescript
import { env } from "./env";

export interface WpTerm {
  id: number;
  slug: string;
  name: string;
}

export interface WpPost {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  date_gmt: string;
  modified_gmt: string;
  featured_media: number;
  auteur: number[];
  voix: number[];
  genre_livre: number[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url: string;
      alt_text: string;
      media_details: { width: number; height: number };
    }>;
    "wp:term"?: Array<Array<WpTerm & { taxonomy: string }>>;
  };
}

export interface WpMedia {
  id: number;
  slug: string;
  title: { rendered: string };
  mime_type: string;
  source_url: string;
  media_details?: { filesize?: number; length?: number; menu_order?: number };
}

class WpClient {
  private base: string;
  constructor(base: string) { this.base = base.replace(/\/$/, ""); }

  private async req(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<{ data: unknown; headers: Headers }> {
    const url = new URL(`${this.base}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      const key = k === "embed" ? "_embed" : k === "perPage" ? "per_page" : k;
      url.searchParams.set(key, String(v));
    }
    const resp = await fetch(url.toString(), { headers: { accept: "application/json" } });
    if (!resp.ok) throw new Error(`WP API ${resp.status} ${url.toString()}`);
    return { data: await resp.json(), headers: resp.headers };
  }

  async *paginatePosts(): AsyncGenerator<WpPost> {
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const { data, headers } = await this.req("/wp-json/wp/v2/posts", { perPage: 100, page, embed: true });
      const posts = data as WpPost[];
      totalPages = Number(headers.get("x-wp-totalpages") || 1);
      for (const p of posts) yield p;
      page++;
    }
  }

  async getMediaChildren(postId: number): Promise<WpMedia[]> {
    const all: WpMedia[] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      try {
        const { data, headers } = await this.req("/wp-json/wp/v2/media", {
          parent: postId, perPage: 100, page, orderby: "menu_order", order: "asc",
        });
        all.push(...(data as WpMedia[]));
        totalPages = Number(headers.get("x-wp-totalpages") || 1);
      } catch (e) {
        const msg = String(e);
        if (msg.includes("rest_post_invalid_id") || msg.includes("400")) return all;
        throw e;
      }
      page++;
    }
    return all.filter((m) => m.mime_type.startsWith("audio/"));
  }
}

export const wpClient = new WpClient(env.wpApiBase);
```

- [ ] **Step 3 : Créer `web/scripts/fetch-content.ts`**

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wpClient, type WpPost } from "../src/lib/wp-client";

const OUT = join(process.cwd(), "src/content/books");

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
  console.log("→ Fetch books from WordPress…");
  let count = 0;
  for await (const post of wpClient.paginatePosts()) {
    const tracks = await wpClient.getMediaChildren(post.id);
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
      })).sort((a, b) => a.order - b.order),
      views: 0,
      publishedAt: post.date_gmt,
      modifiedAt: post.modified_gmt,
      legacyUrl: post.link,
    };
    await writeFile(join(OUT, `${post.slug}.json`), JSON.stringify(book, null, 2));
    count++;
    if (count % 100 === 0) console.log(`  ${count} books…`);
  }
  console.log(`✓ ${count} books written to ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4 : Smoke test du script**

```bash
cd web
WP_API_BASE=https://www.litteratureaudio.com pnpm exec tsx scripts/fetch-content.ts
```

Expected : quelques centaines de livres écrits dans `src/content/books/` avant d'arrêter (le script complet prend ~10 min).

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(web): client WP + script fetch-content pour Astro collections"
```

---

## Task 3 : Content collections + helpers

**Files:**
- Create : `web/src/content/config.ts`
- Create : `web/src/lib/format-duration.ts`
- Create : `web/src/lib/image-url.ts`

**Interfaces:**
- Produces : `collections.books` schema Zod
- Produces : `formatDuration(seconds: number): string`
- Produces : `imageUrl(src, opts, config): string`

- [ ] **Step 1 : Créer `web/src/content/config.ts`**

```typescript
import { defineCollection, z } from "astro:content";

const Track = z.object({
  id: z.number(),
  slug: z.string().default(""),
  title: z.string(),
  order: z.number(),
  url: z.string().url(),
  duration: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
});

const Image = z.object({
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().default(""),
});

const TermRef = z.object({ id: z.number(), slug: z.string(), name: z.string() });

const books = defineCollection({
  type: "data",
  schema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
    title: z.string(),
    excerpt: z.string().default(""),
    content: z.string().default(""),
    cover: Image.optional(),
    durationTotal: z.number().int().nonnegative(),
    authors: z.array(TermRef),
    voices: z.array(TermRef),
    genres: z.array(TermRef),
    tracks: z.array(Track),
    views: z.number().int().nonnegative().default(0),
    publishedAt: z.coerce.date(),
    modifiedAt: z.coerce.date(),
    legacyUrl: z.string().url(),
  }),
});

export const collections = { books };
```

- [ ] **Step 2 : Créer `web/src/lib/format-duration.ts`**

```typescript
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0 min";
  const m = Math.ceil(seconds / 60);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${m} min`;
  if (rem === 0) return `${h} h`;
  return `${h} h ${rem} min`;
}
```

- [ ] **Step 3 : Créer `web/src/lib/image-url.ts`**

```typescript
export interface ImageUrlOpts {
  width?: number;
  format?: "avif" | "webp" | "jpg";
}

export function imageUrl(src: string, opts: ImageUrlOpts): string {
  // V0 : pas de transformation d'image, on retourne l'URL WP d'origine.
  return src;
}
```

- [ ] **Step 4 : Vérifier Astro check**

```bash
cd web
pnpm exec astro check
```

Expected : 0 errors.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(web): content collection books + helpers formatDuration/imageUrl"
```

---

## Task 4 : Layout, composants, home et fiche livre

**Files:**
- Create : `web/src/layouts/Base.astro`
- Create : `web/src/components/Header.astro`
- Create : `web/src/components/Footer.astro`
- Create : `web/src/components/Picture.astro`
- Create : `web/src/components/BookCard.astro`
- Create : `web/src/pages/index.astro`
- Create : `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`
- Create : `web/src/pages/404.astro`
- Create : `web/src/pages/robots.txt.ts`

**Interfaces:**
- Produces : layout `Base.astro` avec SEO
- Produces : page home avec grid de `BookCard`
- Produces : page fiche livre avec URL préservée

- [ ] **Step 1 : Créer `web/src/components/Header.astro`**

```astro
---
const nav = [
  { href: "/", label: "Accueil" },
];
---
<header class="border-b p-4">
  <div class="max-w-6xl mx-auto flex items-center justify-between gap-4">
    <a href="/" class="text-xl font-semibold text-primary" rel="home">Litteratureaudio.com</a>
    <nav aria-label="Navigation principale">
      <ul class="flex gap-4 text-sm">
        {nav.map((item) => (
          <li><a href={item.href} class="hover:underline">{item.label}</a></li>
        ))}
      </ul>
    </nav>
    <form action="/" method="GET" class="hidden sm:flex gap-2">
      <input type="search" name="q" placeholder="Recherche…" aria-label="Rechercher" class="border rounded px-2 py-1 text-sm" />
      <button type="submit" class="bg-primary text-white px-3 py-1 rounded text-sm">OK</button>
    </form>
  </div>
</header>
```

- [ ] **Step 2 : Créer `web/src/components/Footer.astro`**

```astro
---
const year = new Date().getFullYear();
---
<footer class="border-t p-8 mt-12 text-sm text-center text-gray-600">
  <p>© {year} Litteratureaudio.com — Association loi 1901. Contenu sous licence libre.</p>
</footer>
```

- [ ] **Step 3 : Créer `web/src/components/Picture.astro`**

```astro
---
interface Props {
  src: string;
  width: number;
  height: number;
  alt: string;
  loading?: "lazy" | "eager";
  fetchpriority?: "high" | "low" | "auto";
  class?: string;
}

const { src, width, height, alt, loading = "lazy", fetchpriority = "auto", class: cls = "" } = Astro.props;
---
<img
  src={src}
  width={width}
  height={height}
  alt={alt}
  loading={loading}
  fetchpriority={fetchpriority}
  decoding="async"
  class={`w-full h-auto ${cls}`}
/>
```

- [ ] **Step 4 : Créer `web/src/components/BookCard.astro`**

```astro
---
import type { CollectionEntry } from "astro:content";
import { formatDuration } from "../lib/format-duration";
import Picture from "./Picture.astro";

interface Props {
  book: CollectionEntry<"books">;
}

const { book } = Astro.props;
const d = book.data;
const authorsLabel = d.authors.map((a) => a.name).join(", ");
---
<article class="border rounded p-2 hover:shadow transition">
  <a href={`/livre-audio-gratuit-mp3/${d.slug}.html`} class="block">
    {d.cover && (
      <Picture
        src={d.cover.url}
        width={d.cover.width}
        height={d.cover.height}
        alt={d.cover.alt || d.title}
      />
    )}
    <div class="text-xs text-gray-600 mt-1">{formatDuration(d.durationTotal)}</div>
    <h3 class="font-semibold leading-tight mt-1">{d.title}</h3>
    {authorsLabel && <p class="text-sm text-gray-700">{authorsLabel}</p>}
  </a>
</article>
```

- [ ] **Step 5 : Créer `web/src/layouts/Base.astro`**

```astro
---
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import "../styles/global.css";

interface Props {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
}

const { title, description, canonical, image } = Astro.props;
const siteUrl = Astro.site?.toString().replace(/\/$/, "") || "https://litterature.pages.dev";
const canonicalUrl = canonical || new URL(Astro.url.pathname, siteUrl).toString();
const imageUrl = image ? new URL(image, siteUrl).toString() : undefined;
---
<!doctype html>
<html lang="fr-FR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonicalUrl} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonicalUrl} />
    <meta property="og:site_name" content="Litteratureaudio.com" />
    {imageUrl && <meta property="og:image" content={imageUrl} />}
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
  </head>
  <body class="min-h-screen flex flex-col">
    <Header />
    <main class="flex-1 max-w-6xl mx-auto w-full p-4">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 6 : Créer `web/src/pages/index.astro`**

```astro
---
import { getCollection } from "astro:content";
import Base from "../layouts/Base.astro";
import BookCard from "../components/BookCard.astro";

const allBooks = await getCollection("books");
const sortedByDate = [...allBooks].sort(
  (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
);
const nouveautes = sortedByDate.slice(0, 8);
const populaires = [...allBooks].sort((a, b) => b.data.views - a.data.views).slice(0, 12);
---
<Base
  title={`Plus de ${allBooks.length} livres audio gratuits ! | Litteratureaudio.com`}
  description={`La référence du livre audio gratuit francophone : plus de ${allBooks.length} livres audio à écouter et télécharger gratuitement au format MP3 !`}
>
  <section class="mb-10">
    <h2 class="text-2xl font-bold mb-4">Nouveautés</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {nouveautes.map((book) => (
        <BookCard book={book} />
      ))}
    </div>
  </section>

  <section>
    <h2 class="text-2xl font-bold mb-4">Les plus aimés</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {populaires.map((book) => (
        <BookCard book={book} />
      ))}
    </div>
  </section>
</Base>
```

- [ ] **Step 7 : Créer `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`**

```astro
---
import { getCollection } from "astro:content";
import Base from "../../layouts/Base.astro";
import Picture from "../../components/Picture.astro";
import { formatDuration } from "../../lib/format-duration";

export async function getStaticPaths() {
  const books = await getCollection("books");
  return books.map((book) => ({
    params: { slug: book.data.slug },
    props: { book },
  }));
}

const { book } = Astro.props;
const d = book.data;
const authorsLabel = d.authors.map((a) => a.name).join(", ");
const voicesLabel = d.voices.map((v) => v.name).join(", ");
const genresLabel = d.genres.map((g) => g.name).join(", ");
---
<Base
  title={`${d.title} | Litteratureaudio.com`}
  description={d.excerpt || `Livre audio gratuit ${d.title} de ${authorsLabel}.`}
  canonical={d.legacyUrl}
  image={d.cover?.url}
>
  <article>
    <header class="flex flex-col md:flex-row gap-6 mb-8">
      {d.cover && (
        <Picture
          src={d.cover.url}
          width={d.cover.width}
          height={d.cover.height}
          alt={d.cover.alt || d.title}
          loading="eager"
          fetchpriority="high"
        />
      )}
      <div class="flex-1">
        <h1 class="text-3xl font-bold mb-2">{d.title}</h1>
        {authorsLabel && <p class="mb-1">De {authorsLabel}</p>}
        {voicesLabel && <p class="mb-1">Lu par {voicesLabel}</p>}
        <p class="mb-1">Durée : {formatDuration(d.durationTotal)}</p>
        {genresLabel && <p class="mb-1">Genre : {genresLabel}</p>}
      </div>
    </header>

    {d.content && (
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">Description</h2>
        <div class="prose max-w-none" set:html={d.content} />
      </section>
    )}

    {d.tracks.length > 0 && (
      <section>
        <h2 class="text-2xl font-bold mb-4">Télécharger</h2>
        <ul class="list-disc pl-5">
          {d.tracks.map((t) => (
            <li>
              <a href={t.url} download class="text-primary hover:underline">{t.title}</a> ({formatDuration(t.duration)})
            </li>
          ))}
        </ul>
      </section>
    )}
  </article>
</Base>
```

- [ ] **Step 8 : Créer `web/src/pages/404.astro`**

```astro
---
import Base from "../layouts/Base.astro";
---
<Base title="Page introuvable | Litteratureaudio.com" description="La page demandée n'existe pas.">
  <h1 class="text-3xl font-bold mb-4">Page introuvable</h1>
  <p class="mb-4">La page que vous cherchez n'existe pas ou a été déplacée.</p>
  <p><a href="/" class="text-primary hover:underline">Retour à l'accueil</a></p>
</Base>
```

- [ ] **Step 9 : Créer `web/src/pages/robots.txt.ts`**

```typescript
import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /
Sitemap: ${import.meta.env.SITE || "https://litterature.pages.dev"}/sitemap-index.xml
`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
};
```

- [ ] **Step 10 : Vérifier le build avec un échantillon de contenu**

Pour ne pas attendre 10 000 livres, limiter temporairement le script fetch-content à 20 livres, puis restaurer le comportement complet après le test.

```bash
cd web
WP_API_BASE=https://www.litteratureaudio.com pnpm exec tsx scripts/fetch-content.ts
# attendre ~20 livres, Ctrl+C
pnpm exec astro build
```

Expected : `dist/` généré avec `index.html` et au moins quelques fiches livre.

- [ ] **Step 11 : Commit**

```bash
git add -A
git commit -m "feat(web): layout + home + fiche livre + 404 + robots (MVP V0)"
```

---

## Task 5 : Build local complet et vérification

**Files:**
- Aucun — seulement exécution.

- [ ] **Step 1 : Lancer le fetch complet**

```bash
cd web
WP_API_BASE=https://www.litteratureaudio.com pnpm exec tsx scripts/fetch-content.ts
```

Expected : ~10 000 livres dans `src/content/books/`.

- [ ] **Step 2 : Lancer le build complet**

```bash
cd web
pnpm exec astro build
```

Expected : `dist/` contient ~10 000 pages HTML.

- [ ] **Step 3 : Vérifier localement un échantillon**

```bash
cd web
npx serve dist
# ouvrir http://localhost:3000
```

- [ ] **Step 4 : Push et déploiement Cloudflare Pages**

```bash
git push origin main
```

Puis configurer Cloudflare Pages pour déployer depuis GitHub avec :
- Framework preset : Astro
- Build command : `cd web && pnpm build`
- Build output directory : `dist`
- Environment variable : `WP_API_BASE=https://www.litteratureaudio.com`

- [ ] **Step 5 : Commit final si configuration Cloudflare modifiée**

```bash
# Si un wrangler.toml ou autre fichier est créé, le committer
git add -A
git commit -m "chore: configuration Cloudflare Pages pour MVP V0"
```

---

## Self-Review

**Spec coverage :**
- Astro + Tailwind scaffold ✓ (Task 1)
- WP client + fetch-content ✓ (Task 2)
- Content collection books + helpers ✓ (Task 3)
- Layout + Header + Footer + BookCard + Picture + home + fiche livre + 404 + robots ✓ (Task 4)
- Build local + déploiement Cloudflare Pages ✓ (Task 5)
- URLs WordPress préservées ✓ (`/livre-audio-gratuit-mp3/[slug].html`)
- SEO de base ✓ (`Base.astro`)
- Images d'origine WP ✓ (`imageUrl` V0 retourne src tel quel)

**Placeholder scan :** aucun TBD/TODO.

**Type consistency :** `WpPost`, `WpMedia`, `WpTerm` cohérents entre `wp-client.ts` et `fetch-content.ts`. Schema Zod `books` cohérent avec le JSON produit par `fetch-content.ts`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-28-litteratureaudio-mvp-v0-implementation.md`.

**Two execution options:**

1. **Subagent-Driven** — I dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — I execute tasks in this session with checkpoints so we can iterate quickly.

**Which approach?**
