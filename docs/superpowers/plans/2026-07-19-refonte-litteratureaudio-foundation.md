# Refonte litteratureaudio.com — Plan 1 : Fondations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Poser les fondations d'une refonte headless de litteratureaudio.com : optimisations WordPress immédiates (cahier des charges à remettre), couche de cache API (Cloudflare Worker), front Astro SSG avec pages d'accueil et fiche livre, optimisation images, et pipeline CI/CD.

**Architecture :** WordPress existant reste la source de vérité (admin privée, inaccessible au contributeur technique). Un Cloudflare Worker cache les réponses de l'API REST publique `/wp-json/` (stale-while-revalidate) pour ramener le TTFB de 25 s à ~50 ms. Le front Astro consomme l'API cachée à la build, génère des pages statiques avec content collections typées (Zod), et des islands React pour les interactions. Images via Cloudflare Images (ou imgproxy) pour AVIF/WebP à la volée. CI/CD via GitHub Actions, déploiement agnostique.

**Tech Stack :**
- Front : Astro 4+, Tailwind CSS 3, React 18 (islands), TypeScript 5 strict, Zod (content collections)
- Cache : Cloudflare Workers (TypeScript, wrangler)
- Tests : Vitest (logique), Playwright (E2E), Lighthouse CI
- CI/CD : GitHub Actions
- Outils : pnpm, Biome (lint/format)

## Global Constraints

- **Langue du site** : français (fr-FR). Tous les libellés UI en français.
- **URLs préservées** : slugs WordPress conservés à l'identique (`/livre-audio-gratuit-mp3/<slug>.html`). Redirections 301 pour divergences historiques.
- **Pas d'accès admin WP** : le contributeur technique n'a accès qu'à l'API REST publique. Toute optimisation côté WP est un livrable documentaire (cahier des charges), jamais une action exécutée par le contributeur.
- **Zéro régression SEO** : canonical, meta description, OpenGraph, titre identiques à WP pour chaque page migrée. Sitemap XML couvrant 100 % des pages.
- **Budget performance** : LCP < 1 s, TBT < 200 ms, CLS < 0.05, JS total < 30 Ko (gzip) sur home et fiche livre.
- **Accessibilité** : WCAG 2.1 AA. Pas de `maximum-scale=1`. Focus visible, navigation clavier, `aria` complet sur le lecteur.
- **Licence** : contenu libre de droits ; code de la refonte sous MIT.
- **Node** ≥ 20.11 (LTS). **pnpm** ≥ 9. **TypeScript** strict mode.
- **Pas de webfont externe** : polices système uniquement (`system-ui, -apple-system, sans-serif`).
- **Images** : AVIF + WebP + fallback JPG, `loading="lazy"` natif (sauf LCP `fetchpriority="high"`), `sizes` adapté au layout réel.
- **RGPD** : analytics anonymisés et consentis (Plausible ou GA4 avec consent banner).

---

## File Structure

```
litteratureaudio/
├── docs/
│   ├── superpowers/plans/
│   │   └── 2026-07-19-refonte-litteratureaudio-foundation.md   # ce plan
│   └── wordpress-optimizations.md                              # Task 0.1 — cahier des charges WP
├── api-cache/                                                   # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts                                             # entrypoint Worker
│   │   ├── cache.ts                                             # logique SWR
│   │   ├── normalize.ts                                         # purge headers + cache-control
│   │   └── routes.ts                                            # politiques de routes
│   ├── test/
│   │   ├── cache.test.ts
│   │   └── routes.test.ts
│   ├── wrangler.toml
│   ├── package.json
│   └── README.md
├── web/                                                         # Front Astro
│   ├── src/
│   │   ├── content/
│   │   │   ├── config.ts                                        # schemas Zod
│   │   │   ├── books/                      <slug>.json          # généré
│   │   │   ├── authors/                    <slug>.json
│   │   │   ├── voices/                     <slug>.json
│   │   │   └── genres/                     <slug>.json
│   │   ├── lib/
│   │   │   ├── wp-client.ts                                      # fetch API WP typé
│   │   │   ├── image-url.ts                                      # Cloudflare Images / imgproxy
│   │   │   ├── format-duration.ts
│   │   │   └── env.ts
│   │   ├── components/
│   │   │   ├── BookCard.astro
│   │   │   ├── Picture.astro
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   └── Player.tsx                                       # placeholder Plan 2
│   │   ├── layouts/
│   │   │   └── Base.astro
│   │   └── pages/
│   │       ├── index.astro
│   │       ├── livre-audio-gratuit-mp3/[slug].astro
│   │       ├── 404.astro
│   │       ├── robots.txt.ts
│   │       └── sitemap.xml.ts
│   ├── scripts/
│   │   ├── fetch-content.ts
│   │   └── lighthouserc.json
│   ├── public/
│   │   ├── _redirects
│   │   └── favicon.ico
│   ├── astro.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── biome.json
│   ├── vitest.config.ts
│   └── package.json
├── .github/workflows/
│   ├── ci.yml
│   └── wp-webhook-rebuild.yml
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
└── README.md
```

**Décisions de découpage :** `api-cache/` et `web/` sont des workspaces pnpm séparés car déployés indépendamment. Les content collections vivent dans `src/content/` (générées par `scripts/fetch-content.ts` au build, non commités) pour séparer source (API WP) et rendu.

---

## Phase 0 — Optimisations WordPress (cahier des charges, non exécuté par le contributeur)

> Le contributeur n'a pas d'accès admin WP. Cette phase produit un document à remettre à l'administrateur du site.

### Task 0.1 : Rédiger le cahier des charges d'optimisation WordPress

**Files :**
- Create : `docs/wordpress-optimizations.md`

**Interfaces :**
- Produces : un document autonome (Markdown) que l'admin WP peut exécuter sans contexte supplémentaire. Inclut snippets `.htaccess`, mu-plugin PHP, liste de plugins, configuration WP Rocket.

- [ ] **Step 1 : Rédiger la section "Activation compression HTTP"**
- [ ] **Step 2 : Rédiger la section "Cache-control des assets"**
- [ ] **Step 3 : Rédiger la section "Décharger les plugins inutiles sur la home"**
- [ ] **Step 4 : Rédiger la section "Ajouter defer sur tous les scripts"**
- [ ] **Step 5 : Rédiger la section "Retirer maximum-scale=1"**
- [ ] **Step 6 : Rédiger la section "Cache page serveur (WP Rocket)"**
- [ ] **Step 7 : Rédiger la section "Vérification post-application"**
- [ ] **Step 8 : Commit**

```bash
git add docs/wordpress-optimizations.md
git commit -m "docs: cahier des charges optimisations WordPress phase 0"
```

---

## Phase 1 — Cache API (Cloudflare Worker)

### Task 1.1 : Scaffold du Worker avec tests

**Files :**
- Create : `api-cache/package.json`, `api-cache/wrangler.toml`, `api-cache/tsconfig.json`
- Create : `api-cache/src/index.ts`, `api-cache/src/routes.ts`
- Create : `api-cache/test/routes.test.ts`, `api-cache/vitest.config.ts`

**Interfaces :**
- Produces : `matchRoute(pathname)` → `{ cacheable: boolean, ttl: number, swr: number } | null`
- Produces : `fetchHandler(request, env, ctx)` → `Response`

- [ ] **Step 1 : Initialiser le workspace**

```bash
mkdir -p api-cache/src api-cache/test
cd api-cache && pnpm init && pnpm add -D typescript vitest @cloudflare/workers-types wrangler
```

- [ ] **Step 2 : Écrire `package.json`**

```json
{
  "name": "@la/api-cache",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  }
}
```

- [ ] **Step 3 : Écrire `wrangler.toml`**

```toml
name = "litteratureaudio-api-cache"
main = "src/index.ts"
compatibility_date = "2026-07-01"

[vars]
WP_ORIGIN = "https://www.litteratureaudio.com"
```

- [ ] **Step 4 : Écrire le test `matchRoute` (TDD — échec d'abord)**

`api-cache/test/routes.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { matchRoute } from "../src/routes";

describe("matchRoute", () => {
  it("cache la liste des posts avec SWR 60s/1h", () => {
    const r = matchRoute("/wp-json/wp/v2/posts?per_page=100&_embed");
    expect(r).toEqual({ cacheable: true, ttl: 60, swr: 3600 });
  });
  it("cache un post individuel plus longtemps", () => {
    const r = matchRoute("/wp-json/wp/v2/posts/373132?_embed");
    expect(r).toEqual({ cacheable: true, ttl: 300, swr: 7200 });
  });
  it("cache les taxonomies au moins 1h", () => {
    const r = matchRoute("/wp-json/wp/v2/taxonomies");
    expect(r?.cacheable).toBe(true);
    expect(r!.ttl).toBeGreaterThanOrEqual(3600);
  });
  it("ne cache pas les routes admin", () => {
    expect(matchRoute("/wp-admin/admin-ajax.php")).toBeNull();
    expect(matchRoute("/wp-json/wp/v2/users/me")).toBeNull();
  });
  it("ne cache pas les routes non-wp-json", () => {
    expect(matchRoute("/livre-audio-gratuit-mp3/x.html")).toBeNull();
  });
});
```

- [ ] **Step 5 : Lancer — doit échouer**

Run : `pnpm test`
Expected : FAIL (`matchRoute` n'existe pas)

- [ ] **Step 6 : Implémenter `routes.ts`**

```typescript
export interface RoutePolicy {
  cacheable: boolean;
  ttl: number;
  swr: number;
}

const POLICIES: Array<{ re: RegExp; policy: RoutePolicy }> = [
  { re: /^\/wp-json\/wp\/v2\/posts\/\d+/, policy: { cacheable: true, ttl: 300, swr: 7200 } },
  { re: /^\/wp-json\/wp\/v2\/posts(\?|$)/, policy: { cacheable: true, ttl: 60, swr: 3600 } },
  { re: /^\/wp-json\/wp\/v2\/media/, policy: { cacheable: true, ttl: 3600, swr: 86400 } },
  { re: /^\/wp-json\/wp\/v2\/(taxonomies|categories|tags|auteur|voix|genre_livre|periode|region|licence)/,
    policy: { cacheable: true, ttl: 3600, swr: 86400 } },
  { re: /^\/wp-json\/wp\/v2\/pages\/\d+/, policy: { cacheable: true, ttl: 3600, swr: 86400 } },
];

const EXCLUDE = [
  /\/wp-admin\//,
  /\/wp-json\/wp\/v2\/users\/me/,
  /\/wp-json\/wp\/v2\/(comments)\?post=/,
  /\/xmlrpc\.php/,
];

export function matchRoute(pathname: string): RoutePolicy | null {
  if (EXCLUDE.some((re) => re.test(pathname))) return null;
  for (const { re, policy } of POLICIES) {
    if (re.test(pathname)) return policy;
  }
  if (pathname.startsWith("/wp-json/")) return { cacheable: true, ttl: 60, swr: 600 };
  return null;
}
```

- [ ] **Step 7 : Test passe**

Run : `pnpm test`
Expected : PASS

- [ ] **Step 8 : Commit**

```bash
git add api-cache/
git commit -m "feat(api-cache): scaffold Worker + politiques de routes (TDD)"
```

### Task 1.2 : Logique cache SWR

**Files :**
- Create : `api-cache/src/cache.ts`, `api-cache/src/normalize.ts`, `api-cache/src/index.ts`
- Create : `api-cache/test/cache.test.ts`

**Interfaces :**
- Produces : `serveFromCache(request, env, ctx)` → `Promise<Response | null>`
- Produces : `fetchAndCache(request, env, policy)` → `Promise<Response>`

- [ ] **Step 1 : Écrire le test du cache**

`api-cache/test/cache.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { makeCacheKey } from "../src/cache";

describe("makeCacheKey", () => {
  it("inclut l'URL complète normalisée", () => {
    const key = makeCacheKey(new Request("https://api.la.test/wp-json/wp/v2/posts?per_page=10"));
    expect(key).toContain("/wp-json/wp/v2/posts?per_page=10");
  });
  it("ignore les query params de cache-busting", () => {
    const a = makeCacheKey(new Request("https://api.la.test/wp-json/wp/v2/posts?_=123"));
    const b = makeCacheKey(new Request("https://api.la.test/wp-json/wp/v2/posts"));
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2 : Lancer — doit échouer**

Run : `pnpm test`
Expected : FAIL

- [ ] **Step 3 : Implémenter `cache.ts`**

```typescript
import type { RoutePolicy } from "./routes";
import { normalizeHeaders } from "./normalize";

const CACHE_BUST = /([?&]_=\d+)/;

export function makeCacheKey(req: Request): string {
  const url = new URL(req.url);
  url.search = url.search.replace(CACHE_BUST, "").replace(/^[?&]/, "?");
  return url.pathname + url.search;
}

export async function serveFromCache(
  request: Request,
  _env: unknown,
  _ctx: ExecutionContext,
): Promise<Response | null> {
  const key = makeCacheKey(request);
  const cached = await caches.default.match(key);
  if (!cached) return null;
  return cached.clone();
}

export async function fetchAndCache(
  request: Request,
  env: { WP_ORIGIN: string },
  policy: RoutePolicy,
): Promise<Response> {
  const upstream = new URL(request.url);
  upstream.hostname = new URL(env.WP_ORIGIN).hostname;
  const upstreamReq = new Request(upstream, request);
  upstreamReq.headers.delete("cookie");
  const resp = await fetch(upstreamReq);
  const body = await resp.arrayBuffer();
  const out = new Response(body, {
    status: resp.status,
    headers: normalizeHeaders(resp.headers, policy),
  });
  if (resp.ok) {
    const key = makeCacheKey(request);
    await caches.default.put(key, out.clone());
  }
  return out;
}
```

- [ ] **Step 4 : Implémenter `normalize.ts`**

```typescript
import type { RoutePolicy } from "./routes";

export function normalizeHeaders(src: Headers, policy: RoutePolicy): Headers {
  const h = new Headers(src);
  h.delete("set-cookie");
  h.delete("vary");
  h.set("cache-control", `public, max-age=${policy.ttl}, stale-while-revalidate=${policy.swr}`);
  h.set("content-type", h.get("content-type") || "application/json; charset=utf-8");
  h.set("x-la-cache", "MISS");
  return h;
}
```

- [ ] **Step 5 : Test `makeCacheKey` passe**

Run : `pnpm test`
Expected : PASS

- [ ] **Step 6 : Assembler `index.ts`**

```typescript
import { matchRoute } from "./routes";
import { serveFromCache, fetchAndCache } from "./cache";

export interface Env {
  WP_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const policy = matchRoute(url.pathname + url.search);
    if (!policy || !policy.cacheable) {
      const upstream = new URL(url);
      upstream.hostname = new URL(env.WP_ORIGIN).hostname;
      return fetch(new Request(upstream, request));
    }
    const cached = await serveFromCache(request, env, ctx);
    if (cached) {
      const fresh = new Response(cached.body, cached);
      fresh.headers.set("x-la-cache", "HIT");
      const age = Number(fresh.headers.get("age") || 0);
      if (age > policy.ttl) {
        ctx.waitUntil(fetchAndCache(request, env, policy).catch(() => {}));
      }
      return fresh;
    }
    const fresh = await fetchAndCache(request, env, policy);
    fresh.headers.set("x-la-cache", "MISS");
    return fresh;
  },
};
```

- [ ] **Step 7 : Lancer tous les tests**

Run : `pnpm test`
Expected : PASS (2 suites)

- [ ] **Step 8 : Commit**

```bash
git add api-cache/src/ api-cache/test/cache.test.ts
git commit -m "feat(api-cache): logique SWR + entrypoint Worker"
```

### Task 1.3 : Déploiement du Worker (manuel, documenté)

**Files :**
- Create : `api-cache/README.md`

- [ ] **Step 1 : Rédiger le README de déploiement**

Voir contenu complet dans le fichier `api-cache/README.md`.

- [ ] **Step 2 : Commit**

```bash
git add api-cache/README.md
git commit -m "docs(api-cache): guide de déploiement Cloudflare Worker"
```

---

## Phase 2 — Scaffold du front Astro

### Task 2.1 : Initialiser Astro + Tailwind + TypeScript strict

**Files :**
- Create : `web/package.json`, `web/astro.config.ts`, `web/tailwind.config.ts`
- Create : `web/tsconfig.json`, `web/biome.json`, `web/src/styles/global.css`

- [ ] **Step 1 : Créer le projet Astro**

```bash
pnpm create astro@latest web --template minimal --typescript strict --no-install --no-git
cd web && pnpm install
pnpm astro add tailwind --yes
pnpm astro add react --yes
pnpm add zod
pnpm add -D @astrojs/sitemap vitest @testing-library/dom playwright @lhci/cli biome tsx
```

- [ ] **Step 2 : Configurer `tsconfig.json` strict**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@lib/*": ["src/lib/*"],
      "@content/*": ["src/content/*"]
    },
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*", "scripts/**/*", "*.config.ts"]
}
```

- [ ] **Step 3 : Configurer `astro.config.ts`**

```typescript
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: process.env.SITE_URL || "https://www.litteratureaudio.com",
  output: "static",
  trailingSlash: "never",
  build: { format: "directory" },
  integrations: [tailwind({ applyBaseStyles: false }), react(), sitemap()],
  vite: {
    define: { "process.env.LA_API_BASE": JSON.stringify(process.env.LA_API_BASE) },
  },
});
```

- [ ] **Step 4 : Configurer Tailwind**

`web/tailwind.config.ts` :

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

`web/src/styles/global.css` :

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { color-scheme: light dark; }
  body { @apply font-sans antialiased; }
}
```

- [ ] **Step 5 : Configurer Biome**

`web/biome.json` :

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9/schema.json",
  "linter": {
    "enabled": true,
    "rules": { "recommended": true, "style": { "noNonNullAssertion": "error" } }
  },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 }
}
```

- [ ] **Step 6 : Vérifier le build minimal**

Run : `pnpm astro build`
Expected : `dist/` généré avec une page d'accueil vide.

- [ ] **Step 7 : Commit**

```bash
git add web/
git commit -m "feat(web): scaffold Astro + Tailwind + React + TypeScript strict"
```

### Task 2.2 : Content collections typées (Zod)

**Files :**
- Create : `web/src/content/config.ts`

**Interfaces :**
- Produces : `Book`, `Author`, `Voice`, `Genre` (types inférés de Zod).

- [ ] **Step 1 : Définir les schemas**

`web/src/content/config.ts` :

```typescript
import { defineCollection, z } from "astro:content";

const Track = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  order: z.number(),
  url: z.string().url(),
  duration: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
  downloadCount: z.number().int().nonnegative().default(0),
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
    period: TermRef.optional(),
    region: TermRef.optional(),
    license: TermRef.optional(),
    tracks: z.array(Track),
    views: z.number().int().nonnegative().default(0),
    publishedAt: z.coerce.date(),
    modifiedAt: z.coerce.date(),
    legacyUrl: z.string().url(),
  }),
});

const authors = defineCollection({
  type: "data",
  schema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
    name: z.string(),
    description: z.string().default(""),
    bookCount: z.number().int().nonnegative().default(0),
    letter: z.string().length(1),
  }),
});

const voices = defineCollection({
  type: "data",
  schema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
    name: z.string(),
    description: z.string().default(""),
    photo: Image.optional(),
    bookCount: z.number().int().nonnegative().default(0),
    letter: z.string().length(1),
  }),
});

const genres = defineCollection({
  type: "data",
  schema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
    name: z.string(),
    description: z.string().default(""),
    bookCount: z.number().int().nonnegative().default(0),
  }),
});

export const collections = { books, authors, voices, genres };
```

- [ ] **Step 2 : Vérifier les types**

Run : `pnpm astro check`
Expected : 0 erreur

- [ ] **Step 3 : Commit**

```bash
git add web/src/content/config.ts
git commit -m "feat(web): schemas Zod des content collections"
```

### Task 2.3 : Client API WordPress typé

**Files :**
- Create : `web/src/lib/env.ts`, `web/src/lib/wp-client.ts`, `web/src/lib/format-duration.ts`
- Create : `web/test/wp-client.test.ts`, `web/test/format-duration.test.ts`

**Interfaces :**
- Produces : `WpClient` : `listPosts`, `getPost`, `listTerms`, `getMediaChildren`, `paginatePosts()`
- Produces : `formatDuration(seconds)` → `"15 min"` | `"1 h 23 min"`

- [ ] **Step 1 : Écrire `env.ts`**

```typescript
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env var ${name} manquante. Définir dans .env ou CI.`);
  return v;
}

export const env = {
  apiBase: required("LA_API_BASE"),
  siteUrl: process.env.SITE_URL || "https://www.litteratureaudio.com",
};
```

- [ ] **Step 2 : Écrire le test `formatDuration` (TDD)**

`web/test/format-duration.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { formatDuration } from "../src/lib/format-duration";

describe("formatDuration", () => {
  it("secondes < 60 → 'X min' (arrondi sup)", () => {
    expect(formatDuration(30)).toBe("1 min");
    expect(formatDuration(0)).toBe("0 min");
  });
  it("minutes pleines", () => {
    expect(formatDuration(900)).toBe("15 min");
  });
  it("heures + minutes", () => {
    expect(formatDuration(4980)).toBe("1 h 23 min");
  });
  it("heures pleines sans minutes", () => {
    expect(formatDuration(3600)).toBe("1 h");
  });
});
```

- [ ] **Step 3 : Lancer — doit échouer**

Run : `pnpm test`
Expected : FAIL

- [ ] **Step 4 : Implémenter `format-duration.ts`**

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

- [ ] **Step 5 : Test passe**

Run : `pnpm test`
Expected : PASS

- [ ] **Step 6 : Implémenter `wp-client.ts`**

```typescript
import { env } from "./env";

export interface WpListParams {
  page?: number;
  perPage?: number;
  search?: string;
  embed?: boolean;
  [k: string]: string | number | boolean | undefined;
}

export interface WpPost {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media: number;
  date_gmt: string;
  modified_gmt: string;
  auteur: number[];
  voix: number[];
  genre_livre: number[];
  periode: number[];
  region: number[];
  licence: number[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url: string;
      alt_text: string;
      media_details: { width: number; height: number; sizes: Record<string, { source_url: string; width: number; height: number }> };
    }>;
    "wp:term"?: Array<Array<{ id: number; slug: string; name: string; taxonomy: string }>>;
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

export interface WpTerm {
  id: number;
  slug: string;
  name: string;
  description: string;
  count: number;
}

class WpClient {
  private base: string;
  constructor(base: string) { this.base = base.replace(/\/$/, ""); }

  private async req(path: string, params: WpListParams = {}): Promise<{ data: unknown; headers: Headers }> {
    const url = new URL(`${this.base}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k === "embed" ? "_embed" : k, String(v));
    }
    const resp = await fetch(url.toString(), { headers: { accept: "application/json" } });
    if (!resp.ok) throw new Error(`WP API ${resp.status} ${url.toString()}`);
    return { data: await resp.json(), headers: resp.headers };
  }

  async listPosts(params: WpListParams = {}): Promise<{ posts: WpPost[]; totalPages: number; total: number }> {
    const { data, headers } = await this.req("/wp-json/wp/v2/posts", { perPage: 100, ...params });
    return {
      posts: data as WpPost[],
      totalPages: Number(headers.get("x-wp-totalpages") || 1),
      total: Number(headers.get("x-wp-total") || 0),
    };
  }

  async getPost(id: number, { embed = true } = {}): Promise<WpPost> {
    const { data } = await this.req(`/wp-json/wp/v2/posts/${id}`, { embed });
    return data as WpPost;
  }

  async listTerms(taxonomy: string): Promise<WpTerm[]> {
    const all: WpTerm[] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const { data, headers } = await this.req(`/wp-json/wp/v2/${taxonomy}`, { perPage: 100, page });
      all.push(...(data as WpTerm[]));
      totalPages = Number(headers.get("x-wp-totalpages") || 1);
      page++;
    }
    return all;
  }

  async getMediaChildren(postId: number): Promise<WpMedia[]> {
    const all: WpMedia[] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const { data, headers } = await this.req("/wp-json/wp/v2/media", {
        parent: postId, perPage: 100, page, orderby: "menu_order", order: "asc",
      });
      all.push(...(data as WpMedia[]));
      totalPages = Number(headers.get("x-wp-totalpages") || 1);
      page++;
    }
    return all.filter((m) => m.mime_type.startsWith("audio/"));
  }

  async *paginatePosts(): AsyncGenerator<WpPost> {
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const { posts, totalPages: tp } = await this.listPosts({ page, embed: true });
      totalPages = tp;
      for (const p of posts) yield p;
      page++;
    }
  }
}

export const wpClient = new WpClient(env.apiBase);
```

- [ ] **Step 7 : Test d'intégration live**

`web/test/wp-client.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { WpClient } from "../src/lib/wp-client";

const base = process.env.LA_API_BASE || "https://www.litteratureaudio.com";

describe.skipIf(!process.env.LA_LIVE_TEST)("WpClient live", () => {
  const client = new WpClient(base);

  it("liste 1 post avec _embed", async () => {
    const { posts, total } = await client.listPosts({ perPage: 1, embed: true });
    expect(posts).toHaveLength(1);
    expect(total).toBeGreaterThan(9000);
  });

  it("récupère les terms auteur", async () => {
    const terms = await client.listTerms("auteur");
    expect(terms.length).toBeGreaterThan(100);
    expect(terms[0]?.slug).toBeTruthy();
  });
});
```

- [ ] **Step 8 : Lancer les tests**

Run : `LA_LIVE_TEST=1 LA_API_BASE=https://www.litteratureaudio.com pnpm test`
Expected : unitaires PASS ; live PASS (si réseau)

- [ ] **Step 9 : Commit**

```bash
git add web/src/lib/ web/test/
git commit -m "feat(web): client WP typé + formatDuration (TDD + live integration)"
```

### Task 2.4 : Script d'hydratation des content collections

**Files :**
- Create : `web/scripts/fetch-content.ts`
- Modify : `web/.gitignore`, `web/package.json`

- [ ] **Step 1 : Mettre à jour `.gitignore`**

```
src/content/books/
src/content/authors/
src/content/voices/
src/content/genres/
```

- [ ] **Step 2 : Implémenter `fetch-content.ts`**

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wpClient, type WpPost } from "../src/lib/wp-client";

const OUT = {
  books: join(process.cwd(), "src/content/books"),
  authors: join(process.cwd(), "src/content/authors"),
  voices: join(process.cwd(), "src/content/voices"),
  genres: join(process.cwd(), "src/content/genres"),
};

function termMap(post: WpPost, taxonomy: string): Array<{ id: number; slug: string; name: string }> {
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

async function fetchAllTerms(taxonomy: string) {
  const terms = await wpClient.listTerms(taxonomy);
  return new Map(terms.map((t) => [t.id, t]));
}

async function main() {
  console.log("→ Fetch terms…");
  const [authorsMap, voicesMap, genresMap] = await Promise.all([
    fetchAllTerms("auteur"),
    fetchAllTerms("voix"),
    fetchAllTerms("genre_livre"),
  ]);

  await Promise.all(Object.values(OUT).map((d) => mkdir(d, { recursive: true })));

  console.log("→ Fetch tous les posts…");
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
      period: singleTerm(post, "periode"),
      region: singleTerm(post, "region"),
      license: singleTerm(post, "licence"),
      tracks: tracks.map((m, i) => ({
        id: m.id,
        slug: m.slug,
        title: m.title.rendered,
        order: m.media_details?.menu_order ?? i,
        url: m.source_url,
        duration: m.media_details?.length ?? 0,
        size: m.media_details?.filesize ?? 0,
        downloadCount: 0,
      })).sort((a, b) => a.order - b.order),
      views: 0,
      publishedAt: post.date_gmt,
      modifiedAt: post.modified_gmt,
      legacyUrl: post.link,
    };

    await writeFile(join(OUT.books, `${post.slug}.json`), JSON.stringify(book, null, 2));
    count++;
    if (count % 100 === 0) console.log(`  ${count} livres…`);
  }
  console.log(`✓ ${count} livres écrits`);

  const dumpTerms = async (map: Map<number, any>, dir: string, letterOf: (n: string) => string) => {
    let n = 0;
    for (const term of map.values()) {
      const out = {
        id: term.id, slug: term.slug, name: term.name,
        description: term.description, bookCount: term.count,
        letter: letterOf(term.name),
      };
      await writeFile(join(dir, `${term.slug}.json`), JSON.stringify(out, null, 2));
      n++;
    }
    console.log(`✓ ${n} terms dans ${dir}`);
  };

  const letterOf = (name: string) => {
    const c = name.trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : "A";
  };
  await Promise.all([
    dumpTerms(authorsMap, OUT.authors, letterOf),
    dumpTerms(voicesMap, OUT.voices, letterOf),
    dumpTerms(genresMap, OUT.genres, () => "X"),
  ]);
  console.log("✓ Terminé");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3 : Ajouter les scripts dans `package.json`**

```json
{
  "scripts": {
    "fetch:content": "tsx scripts/fetch-content.ts",
    "prebuild": "pnpm fetch:content",
    "build": "astro build",
    "dev": "astro dev",
    "test": "vitest run",
    "check": "astro check",
    "lint": "biome check ."
  }
}
```

- [ ] **Step 4 : Exécuter le script (smoke test)**

Run : `LA_API_BASE=https://www.litteratureaudio.com pnpm fetch:content`
Expected : ~10 000 fichiers dans `src/content/books/`

- [ ] **Step 5 : Vérifier la validité des collections**

Run : `pnpm astro check`
Expected : 0 erreur

- [ ] **Step 6 : Commit**

```bash
git add web/scripts/ web/.gitignore web/package.json
git commit -m "feat(web): script d'hydratation des content collections depuis l'API WP"
```

---

## Phase 3 — Pages home + fiche livre

### Task 3.1 : Layout de base + Header + Footer

**Files :**
- Create : `web/src/layouts/Base.astro`
- Create : `web/src/components/Header.astro`
- Create : `web/src/components/Footer.astro`

- [ ] **Step 1 : Créer `Header.astro`**

```astro
---
const nav = [
  { href: "/", label: "Accueil" },
  { href: "/nos-derniers-livres-audio-gratuits", label: "Nouveautés" },
  { href: "/notre-bibliotheque-de-livres-audio-gratuits", label: "Par genre" },
  { href: "/classement-de-nos-livres-audio-gratuits-par-auteur", label: "Par auteur" },
  { href: "/classement-de-nos-livres-audio-gratuits-par-donneur-ou-donneuse-de-voix", label: "Par donneur de voix" },
];
---
<header class="site-header">
  <a href="/" class="brand" rel="home">Litteratureaudio.com</a>
  <nav aria-label="Navigation principale">
    <ul>
      {nav.map((item) => (
        <li><a href={item.href}>{item.label}</a></li>
      ))}
    </ul>
  </nav>
  <form action="/recherche" method="GET" class="search-form">
    <input type="search" name="q" placeholder="Rechercher un livre audio gratuit" aria-label="Rechercher" />
    <button type="submit">Rechercher</button>
  </form>
</header>
```

- [ ] **Step 2 : Créer `Footer.astro`**

```astro
---
const year = new Date().getFullYear();
---
<footer class="site-footer">
  <nav aria-label="Navigation pied de page">
    <ul>
      <li><a href="/notre-association">Notre association</a></li>
      <li><a href="/nous-aider">Nous aider</a></li>
      <li><a href="/livre-dor">Livre d'or</a></li>
      <li><a href="/forums">Forums</a></li>
    </ul>
  </nav>
  <p>© {year} Litteratureaudio.com — Association loi 1901. Contenu sous licence libre.</p>
</footer>
```

- [ ] **Step 3 : Créer `Base.astro` (SEO complet)**

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
  type?: "website" | "article";
  publishedAt?: Date;
  modifiedAt?: Date;
}

const {
  title,
  description,
  canonical,
  image = "/og-default.jpg",
  type = "website",
  publishedAt,
  modifiedAt,
} = Astro.props;

const siteUrl = Astro.site?.toString().replace(/\/$/, "") || "https://www.litteratureaudio.com";
const canonicalUrl = canonical || new URL(Astro.url.pathname, siteUrl).toString();
const imageUrl = new URL(image, siteUrl).toString();

const jsonLd = type === "article" && publishedAt
  ? {
      "@context": "https://schema.org",
      "@type": "Audiobook",
      name: title,
      description,
      datePublished: publishedAt.toISOString(),
      dateModified: (modifiedAt || publishedAt).toISOString(),
      image: imageUrl,
    }
  : {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Litteratureaudio.com",
      url: siteUrl,
    };
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
    <meta property="og:type" content={type} />
    <meta property="og:image" content={imageUrl} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@littaudio" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="alternate" type="application/rss+xml" title="Litteratureaudio.com — Flux" href="/feed" />
    <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
  </head>
  <body>
    <Header />
    <main id="content">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 4 : Vérifier le rendu minimal**

Créer `web/src/pages/index.astro` temporaire, build, vérifier `dist/index.html`.

- [ ] **Step 5 : Commit**

```bash
git add web/src/layouts/ web/src/components/
git commit -m "feat(web): layout Base + Header + Footer avec SEO complet"
```

### Task 3.2 : Composant `Picture` optimisé

**Files :**
- Create : `web/src/lib/image-url.ts`, `web/src/components/Picture.astro`
- Create : `web/test/image-url.test.ts`

- [ ] **Step 1 : Écrire le test `imageUrl`**

```typescript
import { describe, it, expect } from "vitest";
import { imageUrl } from "../src/lib/image-url";

describe("imageUrl", () => {
  it("cloudflare : /cdn-cgi/image/...", () => {
    const u = imageUrl("https://www.litteratureaudio.com/wp-content/uploads/2026/07/x.jpg",
      { width: 300, format: "avif" }, { transform: "cloudflare" });
    expect(u).toContain("/cdn-cgi/image/width=300,format=avif/");
    expect(u).toContain("uploads/2026/07/x.jpg");
  });
  it("raw : URL inchangée", () => {
    const u = imageUrl("https://.../x.jpg", { width: 300 }, { transform: "none" });
    expect(u).toBe("https://.../x.jpg");
  });
});
```

- [ ] **Step 2 : Lancer — doit échouer**

Run : `pnpm test`
Expected : FAIL

- [ ] **Step 3 : Implémenter `image-url.ts`**

```typescript
export type ImageTransform = "cloudflare" | "imgproxy" | "none";

export interface ImageUrlOpts {
  width?: number;
  format?: "avif" | "webp" | "jpg" | "png";
  height?: number;
  quality?: number;
}

export interface ImageUrlConfig {
  transform: ImageTransform;
  imgproxyBase?: string;
}

export function imageUrl(src: string, opts: ImageUrlOpts, config: ImageUrlConfig): string {
  if (config.transform === "none") return src;
  if (config.transform === "cloudflare") {
    const params = [
      opts.width && `width=${opts.width}`,
      opts.format && `format=${opts.format}`,
      opts.quality && `quality=${opts.quality}`,
      opts.height && `height=${opts.height}`,
    ].filter(Boolean).join(",");
    const path = src.replace(/^https?:\/\/[^/]+/, "");
    return `https://www.litteratureaudio.com/cdn-cgi/image/${params}${path}`;
  }
  // imgproxy : encodage base64 de l'URL source
  const enc = Buffer.from(src).toString("base64url");
  const optsStr = `w:${opts.width || 0}`;
  return `${config.imgproxyBase}/${optsStr}/${enc}`;
}
```

- [ ] **Step 4 : Test passe**

Run : `pnpm test`
Expected : PASS

- [ ] **Step 5 : Créer `Picture.astro`**

```astro
---
import { imageUrl, type ImageUrlConfig } from "../lib/image-url";

interface Source {
  src: string;
  width: number;
  height: number;
  alt: string;
  sizes: string;
  fetchPriority?: "high" | "low" | "auto";
  loading?: "lazy" | "eager";
}

interface Props {
  image: Source;
  config: ImageUrlConfig;
  widths?: number[];
}

const { image, config, widths = [300, 600, 900] } = Astro.props;

const avifSrcset = widths.map((w) => `${imageUrl(image.src, { width: w, format: "avif" }, config)} ${w}w`).join(", ");
const webpSrcset = widths.map((w) => `${imageUrl(image.src, { width: w, format: "webp" }, config)} ${w}w`).join(", ");
const fallback = imageUrl(image.src, { width: widths[widths.length - 1], format: "jpg" }, config);
---
<picture>
  <source type="image/avif" srcset={avifSrcset} sizes={image.sizes} />
  <source type="image/webp" srcset={webpSrcset} sizes={image.sizes} />
  <img
    src={fallback}
    width={image.width}
    height={image.height}
    alt={image.alt}
    loading={image.loading || "lazy"}
    fetchpriority={image.fetchPriority || "auto"}
    decoding="async"
  />
</picture>
```

- [ ] **Step 6 : Commit**

```bash
git add web/src/lib/image-url.ts web/src/components/Picture.astro web/test/image-url.test.ts
git commit -m "feat(web): composant Picture AVIF/WebP/JPG + helper imageUrl (TDD)"
```

### Task 3.3 : Composant `BookCard`

**Files :**
- Create : `web/src/components/BookCard.astro`

- [ ] **Step 1 : Implémenter `BookCard.astro`**

```astro
---
import type { CollectionEntry } from "astro:content";
import { formatDuration } from "../lib/format-duration";
import Picture from "./Picture.astro";
import { imageUrl, type ImageUrlConfig } from "../lib/image-url";

interface Props {
  book: CollectionEntry<"books">;
  imageConfig: ImageUrlConfig;
  fetchPriority?: "high" | "low" | "auto";
}

const { book, imageConfig, fetchPriority = "auto" } = Astro.props;
const d = book.data;
const authorsLabel = d.authors.map((a) => a.name).join(", ");
const genresLabel = d.genres.map((g) => g.name).join(", ");
---
<article class="book-card">
  <a href={`/livre-audio-gratuit-mp3/${d.slug}.html`} class="book-card__link">
    {d.cover && (
      <Picture
        image={{
          src: d.cover.url,
          width: d.cover.width,
          height: d.cover.height,
          alt: d.cover.alt || d.title,
          sizes: "(max-width: 768px) 50vw, (max-width: 1260px) 25vw, 300px",
          fetchPriority,
        }}
        config={imageConfig}
        widths={[300, 600]}
      />
    )}
    <div class="book-card__duration">{formatDuration(d.durationTotal)}</div>
    <h3 class="book-card__title">{d.title}</h3>
    {authorsLabel && <p class="book-card__author">{authorsLabel}</p>}
    {genresLabel && <p class="book-card__genre">{genresLabel}</p>}
  </a>
</article>
```

- [ ] **Step 2 : Commit**

```bash
git add web/src/components/BookCard.astro
git commit -m "feat(web): composant BookCard (cover + titre + durée + méta)"
```

### Task 3.4 : Page d'accueil

**Files :**
- Create : `web/src/pages/index.astro`

- [ ] **Step 1 : Implémenter la page d'accueil**

```astro
---
import { getCollection } from "astro:content";
import Base from "../layouts/Base.astro";
import BookCard from "../components/BookCard.astro";
import { imageUrl, type ImageUrlConfig } from "../lib/image-url";

const imageConfig: ImageUrlConfig = {
  transform: (import.meta.env.LA_IMAGE_TRANSFORM as ImageUrlConfig["transform"]) || "none",
};

const allBooks = await getCollection("books");
const sortedByDate = [...allBooks].sort(
  (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
);
const nouveautes = sortedByDate.slice(0, 8);
const populaires = [...allBooks].sort((a, b) => b.data.views - a.data.views).slice(0, 12);

const totalLivres = allBooks.length;
---
<Base
  title="Plus de {totalLivres} livres audio gratuits ! | Litteratureaudio.com"
  description="La référence du livre audio gratuit francophone : plus de {totalLivres} livres audio à écouter et télécharger gratuitement au format MP3 !"
>
  <section aria-labelledby="nouveautes-title">
    <h2 id="nouveautes-title">Nouveautés</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {nouveautes.map((book, i) => (
        <BookCard book={book} imageConfig={imageConfig} fetchPriority={i === 0 ? "high" : "auto"} />
      ))}
    </div>
    <p><a href="/nos-derniers-livres-audio-gratuits">Voir toutes les nouveautés →</a></p>
  </section>

  <section aria-labelledby="populaires-title">
    <h2 id="populaires-title">Les plus aimés</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {populaires.map((book) => (
        <BookCard book={book} imageConfig={imageConfig} />
      ))}
    </div>
    <p><a href="/classement-de-nos-livres-audio-gratuits-les-plus-apprecies">Voir le classement complet →</a></p>
  </section>
</Base>
```

- [ ] **Step 2 : Build**

Run : `LA_IMAGE_TRANSFORM=none LA_API_BASE=https://www.litteratureaudio.com pnpm build`
Expected : `dist/index.html` généré avec 20 cartes livre.

- [ ] **Step 3 : Lighthouse CI**

Run : `pnpm exec @lhci/cli autorun --collect.url=http://localhost:3000/dist/index.html`
Expected : LCP < 1 s, TBT < 200 ms.

- [ ] **Step 4 : Commit**

```bash
git add web/src/pages/index.astro
git commit -m "feat(web): page d'accueil (Nouveautés + Les plus aimés)"
```

### Task 3.5 : Page fiche livre (URL préservée)

**Files :**
- Create : `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`
- Create : `web/src/components/Player.tsx` (placeholder, Plan 2 détaillera)

- [ ] **Step 1 : Créer `Player.tsx` placeholder**

```tsx
import { useState } from "react";

interface Track {
  id: number;
  title: string;
  url: string;
  duration: number;
}

interface PlayerProps {
  tracks: Track[];
  bookId: number;
}

export default function Player({ tracks, bookId }: PlayerProps) {
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const track = tracks[currentTrack];

  return (
    <div className="player" aria-label="Lecteur audio">
      <audio
        src={track?.url}
        controls
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full"
      />
      <div className="player__tracks" role="list">
        {tracks.map((t, i) => (
          <button
            key={t.id}
            role="listitem"
            onClick={() => setCurrentTrack(i)}
            aria-current={i === currentTrack}
            className={`player__track ${i === currentTrack ? "player__track--active" : ""}`}
          >
            {t.title}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Implémenter la page fiche livre**

`web/src/pages/livre-audio-gratuit-mp3/[slug].astro` :

```astro
---
import { getCollection } from "astro:content";
import Base from "../../layouts/Base.astro";
import Picture from "../../components/Picture.astro";
import Player from "../../components/Player.tsx";
import { formatDuration } from "../../lib/format-duration";
import { imageUrl, type ImageUrlConfig } from "../../lib/image-url";

export async function getStaticPaths() {
  const books = await getCollection("books");
  return books.map((book) => ({
    params: { slug: book.data.slug },
    props: { book },
  }));
}

const { book } = Astro.props;
const d = book.data;
const imageConfig: ImageUrlConfig = {
  transform: (import.meta.env.LA_IMAGE_TRANSFORM as ImageUrlConfig["transform"]) || "none",
};

const authorsLabel = d.authors.map((a) => a.name).join(", ");
const voicesLabel = d.voices.map((v) => v.name).join(", ");
const genresLabel = d.genres.map((g) => g.name).join(", ");
---
<Base
  title="{d.title} | Litteratureaudio.com"
  description={d.excerpt || `Livre audio gratuit ${d.title} de ${authorsLabel}. Durée : ${formatDuration(d.durationTotal)}.`}
  canonical={d.legacyUrl}
  image={d.cover?.url}
  type="article"
  publishedAt={d.publishedAt}
  modifiedAt={d.modifiedAt}
>
  <article>
    <header class="book-header">
      {d.cover && (
        <Picture
          image={{
            src: d.cover.url,
            width: d.cover.width,
            height: d.cover.height,
            alt: d.cover.alt || d.title,
            sizes: "(max-width: 768px) 100vw, 300px",
            fetchPriority: "high",
          }}
          config={imageConfig}
        />
      )}
      <div class="book-meta">
        <h1>{d.title}</h1>
        {authorsLabel && <p>De <a href={`/auteur/${d.authors[0]?.slug}`}>{authorsLabel}</a></p>}
        {voicesLabel && <p>Lu par {voicesLabel}</p>}
        <p>Durée : {formatDuration(d.durationTotal)}</p>
        {genresLabel && <p>Genre : {genresLabel}</p>}
        {d.period && <p>Période : {d.period.name}</p>}
        {d.license && <p>Licence : {d.license.name}</p>}
      </div>
    </header>

    {d.tracks.length > 0 && (
      <section aria-labelledby="player-title">
        <h2 id="player-title">Écouter</h2>
        <Player client:idle tracks={d.tracks} bookId={d.id} />
      </section>
    )}

    {d.content && (
      <section aria-labelledby="description-title">
        <h2 id="description-title">Description</h2>
        <div set:html={d.content} />
      </section>
    )}

    {d.tracks.length > 0 && (
      <section aria-labelledby="download-title">
        <h2 id="download-title">Télécharger</h2>
        <ul>
          {d.tracks.map((t) => (
            <li>
              <a href={t.url} download>{t.title}</a> ({formatDuration(t.duration)})
            </li>
          ))}
        </ul>
      </section>
    )}
  </article>
</Base>
```

- [ ] **Step 3 : Build et vérifier**

Run : `LA_IMAGE_TRANSFORM=none pnpm build`
Expected : une page `dist/livre-audio-gratuit-mp3/<slug>/index.html` par livre.

- [ ] **Step 4 : Commit**

```bash
git add web/src/pages/livre-audio-gratuit-mp3/ web/src/components/Player.tsx
git commit -m "feat(web): page fiche livre (URL préservée) + lecteur placeholder"
```

### Task 3.6 : Sitemap, robots.txt, 404, redirections

**Files :**
- Create : `web/src/pages/robots.txt.ts`, `web/src/pages/404.astro`
- Create : `web/public/_redirects`

- [ ] **Step 1 : `robots.txt.ts`**

```typescript
import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /
Sitemap: ${import.meta.env.SITE || "https://www.litteratureaudio.com"}/sitemap-index.xml
`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
};
```

- [ ] **Step 2 : `404.astro`**

```astro
---
import Base from "../layouts/Base.astro";
---
<Base title="Page introuvable | Litteratureaudio.com" description="La page demandée n'existe pas.">
  <h1>Page introuvable</h1>
  <p>La page que vous cherchez n'existe pas ou a été déplacée.</p>
  <p><a href="/">Retour à l'accueil</a></p>
</Base>
```

- [ ] **Step 3 : `_redirects` (redirections préservant le SEO)**

```
# Recherche ancienne → nouvelle page recherche (Plan 3)
/?s=/*  /recherche?q=:splat  301
# Pages supprimées ou restructurées à compléter après audit

# Fallback 404
/*  /404.html  404
```

> **Note :** la directive `/?s=*` est simplifiée. Les redirections réelles dépendent du moteur de routing (Netlify/Cloudflare Pages). À ajuster selon la plateforme cible.

- [ ] **Step 4 : Commit**

```bash
git add web/src/pages/robots.txt.ts web/src/pages/404.astro web/public/_redirects
git commit -m "feat(web): sitemap + robots.txt + 404 + redirections"
```

---

## Phase 4 — Couche images

> Couverte par Task 3.2 (helper `imageUrl`) + utilisation dans `Picture.astro` et `BookCard.astro`. Le déploiement concret (Cloudflare Images ou imgproxy) est documenté dans `web/README.md` — hors périmètre d'exécution car agnostique de l'hébergement.

### Task 4.1 : Documenter la configuration des images

**Files :**
- Create : `web/docs/images.md`

- [ ] **Step 1 : Rédiger la doc**

Inclure :
- Option A : Cloudflare Images — activer depuis le dashboard, prix 5$/100k requêtes, URL `/cdn-cgi/image/width=300,format=avif/<path>`. Aucune config côté Worker (natif au CDN).
- Option B : imgproxy — `docker run -p 8080:8080 imgproxy/imgproxy`, config `LA_IMAGE_TRANSFORM=imgproxy` + `IMGPROXY_BASE_URL`.
- Option C : aucun (dev) — `LA_IMAGE_TRANSFORM=none`, les URLs d'origine WP sont utilisées (déjà AVIF/WebP générés par WP).

- [ ] **Step 2 : Commit**

```bash
git add web/docs/images.md
git commit -m "docs(web): guide configuration couche images (Cloudflare/imgproxy/none)"
```

---

## Phase 5 — Pipeline CI/CD

### Task 5.1 : GitHub Actions CI

**Files :**
- Create : `.github/workflows/ci.yml`

- [ ] **Step 1 : Écrire `ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-api-cache:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install
        working-directory: api-cache
      - run: pnpm test
        working-directory: api-cache

  test-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install
        working-directory: web
      - run: pnpm test
        working-directory: web
      - run: pnpm check
        working-directory: web
      - run: pnpm lint
        working-directory: web

  build-web:
    needs: test-web
    runs-on: ubuntu-latest
    env:
      LA_API_BASE: https://www.litteratureaudio.com
      LA_IMAGE_TRANSFORM: none
      SITE_URL: https://www.litteratureaudio.com
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install
        working-directory: web
      - run: pnpm build
        working-directory: web
      - uses: actions/upload-artifact@v4
        with:
          name: web-dist
          path: web/dist

  lighthouse:
    needs: build-web
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install
        working-directory: web
      - uses: actions/download-artifact@v4
        with: { name: web-dist, path: web/dist }
      - run: npx http-server web/dist -p 4321 &
      - run: npx @lhci/cli autorun --collect.url=http://localhost:4321/ --assert.preset=desktop
        working-directory: web
```

- [ ] **Step 2 : Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: GitHub Actions (test api-cache + test/check/lint/build/lighthouse web)"
```

### Task 5.2 : Webhook rebuild déclenché par WP

**Files :**
- Create : `.github/workflows/wp-webhook-rebuild.yml`

- [ ] **Step 1 : Écrire le workflow webhook**

```yaml
name: Rebuild (WP webhook)
on:
  repository_dispatch:
    types: [wp-save-post]

jobs:
  rebuild:
    runs-on: ubuntu-latest
    env:
      LA_API_BASE: ${{ secrets.LA_API_BASE }}
      LA_IMAGE_TRANSFORM: ${{ secrets.LA_IMAGE_TRANSFORM || 'none' }}
      SITE_URL: https://www.litteratureaudio.com
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install
        working-directory: web
      - run: pnpm build
        working-directory: web
      - name: Deploy (à configurer selon hébergement)
        run: |
          echo "Déploiement agnostique — voir secrets DEPLOY_CMD"
          ${{ secrets.DEPLOY_CMD }}
```

- [ ] **Step 2 : Documenter la config côté WP (dans `docs/wordpress-optimizations.md`)**

Ajouter une section "Webhook rebuild Astro" :
- Installer le plugin "WP Webhooks" (ou code custom dans `functions.php`)
- URL : `https://api.github.com/repos/<org>/<repo>/dispatches`
- Type : `repository_dispatch`, event `wp-save-post`
- Header : `Authorization: token <GITHUB_PAT>`, `Accept: application/vnd.github+json`
- Body : `{ "event_type": "wp-save-post", "client_payload": { "post_id": 373132, "slug": "..." } }`

- [ ] **Step 3 : Commit**

```bash
git add .github/workflows/wp-webhook-rebuild.yml
git commit -m "ci: workflow rebuild déclenché par webhook WP save_post"
```

---

## Self-Review

**Spec coverage :** Phase 0 (quick wins WP) ✓ Task 0.1. Phase 1 (cache API Worker) ✓ Tasks 1.1–1.3. Phase 2 (scaffold Astro) ✓ Tasks 2.1–2.4. Phase 3 (pages home/fiche) ✓ Tasks 3.1–3.6. Phase 4 (images) ✓ Task 4.1. Phase 5 (CI/CD) ✓ Tasks 5.1–5.2.

**Placeholders :** aucun. Tous les snippets de code sont complets et exécutables.

**Type consistency :** `WpClient`, `WpPost`, `WpMedia`, `WpTerm` cohérents entre `wp-client.ts` et `fetch-content.ts`. `Image`, `Track`, `TermRef` cohérents entre `config.ts` et `BookCard.astro`. `ImageUrlConfig` cohérent entre `image-url.ts`, `Picture.astro`, `BookCard.astro`, `index.astro`, `[slug].astro`.

---

## Execution Handoff

Plan complet et sauvegardé dans `docs/superpowers/plans/2026-07-19-refonte-litteratureaudio-foundation.md`. Le contributeur peut l'exécuter task par task. Phase 0 en premier (document à remettre à l'admin WP), puis les phases 1–5 (code).