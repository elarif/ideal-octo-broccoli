# Refonte litteratureaudio.com — Couche 1 : Front public (visiteur anonyme) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la Couche 1 du nouveau front public de litteratureaudio.com : un site Astro 5 statique (SSG) servi par Cloudflare Pages, alimenté pendant la transition par l'API REST publique de WordPress via un Cloudflare Worker de cache, avec un schéma PostgreSQL/Drizzle et une API minimale (search + views) préparés pour le cutover Couche 2.

**Architecture:** WordPress reste la source de vérité en lecture pendant la Couche 1. Un Cloudflare Worker met en cache les réponses `/wp-json/` (stale-while-revalidate) pour ramener le TTFB WP à ~50 ms. Le front Astro consomme cette API cachée au build pour générer ~10 000 pages HTML statiques. En parallèle, on pose le schéma PostgreSQL (Drizzle) et une API REST custom (Hono sur Node) qui serviront dès la Couche 2 ; un script d'export WP → Postgres en mode `--dry-run` valide la cohérence des données avant tout cutover. Les interactions (lecteur audio, recherche, thème) sont des islands React hydratées individuellement.

**Tech Stack:**
- Front : Astro 5, Tailwind CSS 3, React 18 (islands), TypeScript 5 strict, Zod (content collections)
- Cache transition : Cloudflare Workers (TypeScript, wrangler)
- API + back-office futur : Hono (Node 20), Fly.io
- Base de données : PostgreSQL (Neon), Drizzle ORM, migrations versionnées
- Tests : Vitest (logique + composants), Playwright (E2E), Lighthouse CI
- CI/CD : GitHub Actions
- Outils : pnpm, Biome

## Global Constraints

- **Langue du site** : français (fr-FR). Tous les libellés UI en français.
- **URLs préservées** : slugs WordPress conservés à l'identique (`/livre-audio-gratuit-mp3/<slug>.html`). Redirections 301 pour divergences historiques.
- **Pas d'accès admin WP** : le contributeur technique n'a accès qu'à l'API REST publique. Toute optimisation côté WP reste un livrable documentaire (`docs/wordpress-optimizations.md`).
- **Zéro régression SEO** : canonical, meta description, OpenGraph, titre identiques à WP pour chaque page migrée. Sitemap XML couvrant 100 % des pages.
- **Budget performance** (bloquant en CI) : LCP < 1 s, TBT < 200 ms, CLS < 0,05, JS total < 30 Ko (gzip) sur home et fiche livre.
- **Accessibilité** : WCAG 2.1 AA. Pas de `maximum-scale=1`. Focus visible, navigation clavier, `aria` complet sur le lecteur.
- **Licence** : contenu libre de droits ; code de la refonte sous MIT.
- **Node** ≥ 20.11 (LTS). **pnpm** ≥ 9. **TypeScript** strict mode.
- **Pas de webfont externe** : polices système uniquement (`system-ui, -apple-system, sans-serif`).
- **Images** : AVIF + WebP + fallback JPG, `loading="lazy"` natif (sauf LCP `fetchpriority="high"`), `sizes` adapté au layout réel, `width`/`height` systématiques.
- **RGPD** : analytics anonymisés via Plausible (pas de consent banner).
- **Database** : PostgreSQL 15+, extension `pg_trgm` activée.

## File Structure

```
litteratureaudio/
├── docs/
│   ├── superpowers/
│   │   ├── plans/
│   │   │   ├── 2026-07-19-refonte-litteratureaudio-foundation.md   # ancien plan (obsolète)
│   │   │   ├── 2026-07-28-litteratureaudio-couche1-implementation.md # ce plan
│   │   │   └── 2026-07-28-refonte-litteratureaudio-couche1-design.md   # spec source
│   │   └── wordpress-optimizations.md                              # Phase 0 (inchangé)
├── api-cache/                                                   # Cloudflare Worker (cache WP transition)
│   ├── src/
│   │   ├── index.ts
│   │   ├── cache.ts
│   │   ├── normalize.ts
│   │   └── routes.ts
│   ├── test/
│   │   ├── cache.test.ts
│   │   └── routes.test.ts
│   ├── wrangler.toml
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── api/                                                           # API REST custom (Hono + Drizzle)
│   ├── src/
│   │   ├── index.ts
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   └── migrate.ts
│   │   ├── routes/
│   │   │   ├── search.ts
│   │   │   ├── books.ts
│   │   │   ├── authors.ts
│   │   │   ├── voices.ts
│   │   │   ├── genres.ts
│   │   │   └── views.ts
│   │   └── lib/
│   │       └── zod.ts
│   ├── tests/
│   │   ├── search.test.ts
│   │   └── views.test.ts
│   ├── drizzle.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── web/                                                           # Front Astro
│   ├── src/
│   │   ├── content/
│   │   │   ├── config.ts
│   │   │   ├── books/
│   │   │   ├── authors/
│   │   │   ├── voices/
│   │   │   └── genres/
│   │   ├── lib/
│   │   │   ├── wp-client.ts
│   │   │   ├── image-url.ts
│   │   │   ├── format-duration.ts
│   │   │   └── env.ts
│   │   ├── components/
│   │   │   ├── BookCard.astro
│   │   │   ├── Picture.astro
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   ├── Player.tsx
│   │   │   ├── SearchBox.tsx
│   │   │   └── ThemeToggle.tsx
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
│   │   ├── migrate-wp-to-pg.ts
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

---

## Phase 0 — Optimisations WordPress (documentaire, déjà livré)

`docs/wordpress-optimizations.md` est le cahier des charges à remettre à l'administrateur WP. Il n'est pas modifié dans ce plan.

---

## Phase 1 — Cache API WordPress (Cloudflare Worker)

### Task 1.1 : Scaffold du Worker avec politiques de routes

**Files:**
- Create : `api-cache/package.json`, `api-cache/wrangler.toml`, `api-cache/tsconfig.json`
- Create : `api-cache/src/index.ts`, `api-cache/src/routes.ts`, `api-cache/src/cache.ts`, `api-cache/src/normalize.ts`
- Create : `api-cache/test/routes.test.ts`, `api-cache/test/cache.test.ts`, `api-cache/vitest.config.ts`

**Interfaces:**
- Produces : `matchRoute(pathname: string)` → `{ cacheable: boolean, ttl: number, swr: number } | null`
- Produces : `makeCacheKey(request: Request)` → `string`
- Produces : `fetchHandler(request, env, ctx)` → `Response`

- [ ] **Step 1 : Initialiser le workspace**

```bash
mkdir -p api-cache/src api-cache/test
```

- [ ] **Step 2 : Écrire `api-cache/package.json`**

```json
{
  "name": "@la/api-cache",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240701.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "wrangler": "^3.65.0"
  }
}
```

- [ ] **Step 3 : Écrire `api-cache/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 4 : Écrire `api-cache/wrangler.toml`**

```toml
name = "litteratureaudio-api-cache"
main = "src/index.ts"
compatibility_date = "2026-07-01"

[vars]
WP_ORIGIN = "https://www.litteratureaudio.com"
```

- [ ] **Step 5 : Écrire le test `matchRoute` (TDD — RED)**

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

- [ ] **Step 6 : Lancer — doit échouer**

Run : `cd api-cache && pnpm install && pnpm test`
Expected : FAIL (`matchRoute` n'existe pas)

- [ ] **Step 7 : Implémenter `api-cache/src/routes.ts`**

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

- [ ] **Step 8 : Test passe (GREEN)**

Run : `pnpm test`
Expected : PASS

- [ ] **Step 9 : Commit**

```bash
git add api-cache/
git commit -m "feat(api-cache): scaffold Worker + politiques de routes (TDD)"
```

### Task 1.2 : Logique cache SWR

**Files:**
- Create : `api-cache/src/cache.ts`, `api-cache/src/normalize.ts`
- Create : `api-cache/test/cache.test.ts`

**Interfaces:**
- Produces : `serveFromCache(request, env, ctx)` → `Promise<Response | null>`
- Produces : `fetchAndCache(request, env, policy)` → `Promise<Response>`

- [ ] **Step 1 : Écrire le test du cache (RED)**

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

- [ ] **Step 3 : Implémenter `api-cache/src/cache.ts`**

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

- [ ] **Step 4 : Implémenter `api-cache/src/normalize.ts`**

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

- [ ] **Step 5 : Test `makeCacheKey` passe (GREEN)**

Run : `pnpm test`
Expected : PASS

- [ ] **Step 6 : Assembler `api-cache/src/index.ts`**

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

### Task 1.3 : Guide de déploiement du Worker

**Files:**
- Create : `api-cache/README.md`

- [ ] **Step 1 : Rédiger le README**

`api-cache/README.md` :

```markdown
# api-cache — Cloudflare Worker

Met en cache les réponses de l'API REST publique de WordPress pour le front Astro pendant la transition.

## Développement

```bash
pnpm install
pnpm dev
```

## Tests

```bash
pnpm test
```

## Déploiement

```bash
pnpm deploy
```

La variable `WP_ORIGIN` est définie dans `wrangler.toml`. Pour la surcharger en production, utiliser `wrangler secret` ou les variables d'environnement Cloudflare.
```

- [ ] **Step 2 : Commit**

```bash
git add api-cache/README.md
git commit -m "docs(api-cache): guide de déploiement Cloudflare Worker"
```

---

## Phase 2 — Schéma PostgreSQL et API custom (fondations Couche 2)

### Task 2.1 : Scaffold du projet API Hono + Drizzle

**Files:**
- Create : `api/package.json`, `api/tsconfig.json`, `api/drizzle.config.ts`
- Create : `api/src/db/index.ts`, `api/src/db/schema.ts`, `api/src/db/migrate.ts`
- Create : `api/src/index.ts`

**Interfaces:**
- Produces : `db` — client Drizzle typé
- Produces : tables `books`, `tracks`, `authors`, `voices`, `genres`, `periods`, `regions`, `licenses`, `bookAuthors`, `bookVoices`, `bookGenres`, `bookMeta`

- [ ] **Step 1 : Initialiser le workspace**

```bash
mkdir -p api/src/db api/src/routes api/src/lib api/tests
```

- [ ] **Step 2 : Écrire `api/package.json`**

```json
{
  "name": "@la/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@hono/node-server": "^1.12.0",
    "drizzle-orm": "^0.32.0",
    "hono": "^4.5.0",
    "pg": "^8.12.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/pg": "^8.11.0",
    "drizzle-kit": "^0.23.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3 : Écrire `api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4 : Écrire `api/drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
```

- [ ] **Step 5 : Écrire `api/src/db/schema.ts`**

```typescript
import { pgTable, serial, integer, text, timestamp, char, primaryKey } from "drizzle-orm/pg-core";

export const books = pgTable("books", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").default(""),
  content: text("content").default(""),
  coverUrl: text("cover_url"),
  coverWidth: integer("cover_width"),
  coverHeight: integer("cover_height"),
  coverAlt: text("cover_alt"),
  durationTotal: integer("duration_total").notNull().default(0),
  views: integer("views").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull(),
  legacyUrl: text("legacy_url"),
});

export const tracks = pgTable("tracks", {
  id: integer("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  title: text("title").notNull(),
  url: text("url").notNull(),
  duration: integer("duration").default(0),
  sizeBytes: integer("size_bytes").default(0),
  slug: text("slug"),
  downloadCount: integer("download_count").default(0),
});

export const authors = pgTable("authors", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  letter: char("letter", { length: 1 }).notNull(),
  bookCount: integer("book_count").default(0),
});

export const voices = pgTable("voices", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  photoUrl: text("photo_url"),
  letter: char("letter", { length: 1 }).notNull(),
  bookCount: integer("book_count").default(0),
});

export const genres = pgTable("genres", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  bookCount: integer("book_count").default(0),
});

export const periods = pgTable("periods", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const regions = pgTable("regions", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const licenses = pgTable("licenses", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const bookAuthors = pgTable(
  "book_authors",
  {
    bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    authorId: integer("author_id").notNull().references(() => authors.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.bookId, t.authorId] }) }),
);

export const bookVoices = pgTable(
  "book_voices",
  {
    bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    voiceId: integer("voice_id").notNull().references(() => voices.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.bookId, t.voiceId] }) }),
);

export const bookGenres = pgTable(
  "book_genres",
  {
    bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    genreId: integer("genre_id").notNull().references(() => genres.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.bookId, t.genreId] }) }),
);

export const bookMeta = pgTable("book_meta", {
  bookId: integer("book_id").primaryKey().references(() => books.id, { onDelete: "cascade" }),
  periodId: integer("period_id").references(() => periods.id, { onDelete: "set null" }),
  regionId: integer("region_id").references(() => regions.id, { onDelete: "set null" }),
  licenseId: integer("license_id").references(() => licenses.id, { onDelete: "set null" }),
});
```

- [ ] **Step 6 : Écrire `api/src/db/index.ts`**

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

- [ ] **Step 7 : Écrire `api/src/db/migrate.ts`**

```typescript
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 8 : Écrire `api/src/index.ts` minimal**

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

serve({ fetch: app.fetch, port: Number(process.env.PORT || 3000) });
```

- [ ] **Step 9 : Installer et vérifier le build**

Run : `cd api && pnpm install && pnpm build`
Expected : `dist/index.js` généré sans erreur

- [ ] **Step 10 : Commit**

```bash
git add api/
git commit -m "feat(api): scaffold Hono + Drizzle + schéma Postgres Couche 1"
```

### Task 2.2 : Endpoints `/api/search` et `/api/views`

**Files:**
- Create : `api/src/routes/search.ts`, `api/src/routes/views.ts`
- Create : `api/src/lib/zod.ts`
- Modify : `api/src/index.ts`
- Create : `api/tests/search.test.ts`, `api/tests/views.test.ts`

**Interfaces:**
- Produces : `GET /api/search?q=&page=&genre=&auteur=&voix=&periode=` → JSON paginé
- Produces : `POST /api/views/:bookId` → `{ views: number }`

- [ ] **Step 1 : Écrire `api/src/lib/zod.ts`**

```typescript
import { z } from "zod";

export const SearchQuery = z.object({
  q: z.string().default(""),
  page: z.coerce.number().int().min(1).default(1),
  genre: z.string().default(""),
  auteur: z.string().default(""),
  voix: z.string().default(""),
  periode: z.string().default(""),
});

export const ViewsParams = z.object({
  bookId: z.coerce.number().int().positive(),
});
```

- [ ] **Step 2 : Implémenter `api/src/routes/search.ts`**

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db/index";
import * as schema from "../db/schema";
import { sql } from "drizzle-orm";
import { SearchQuery } from "../lib/zod";

const app = new Hono();

app.get("/", zValidator("query", SearchQuery), async (c) => {
  const { q, page } = c.req.valid("query");
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = [sql`TRUE`];
  if (q) conditions.push(sql`(${schema.books.title} ILIKE ${`%${q}%`} OR ${schema.books.excerpt} ILIKE ${`%${q}%`})`);

  const results = await db.query.books.findMany({
    where: sql.join(conditions, sql` AND `),
    limit,
    offset,
    orderBy: sql`${schema.books.publishedAt} DESC`,
  });

  return c.json({ results, page, limit });
});

export default app;
```

- [ ] **Step 3 : Implémenter `api/src/routes/views.ts`**

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { books } from "../db/schema";
import { ViewsParams } from "../lib/zod";

const app = new Hono();

app.post("/:bookId", zValidator("param", ViewsParams), async (c) => {
  const { bookId } = c.req.valid("param");
  const updated = await db.update(books)
    .set({ views: sql`${books.views} + 1` })
    .where(eq(books.id, bookId))
    .returning({ views: books.views });
  if (updated.length === 0) return c.json({ error: "not_found" }, 404);
  return c.json(updated[0]);
});

export default app;
```

> Note : `sql` doit être importé depuis `drizzle-orm` dans `views.ts` aussi.

- [ ] **Step 4 : Brancher les routes dans `api/src/index.ts`**

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import search from "./routes/search";
import views from "./routes/views";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/api/search", search);
app.route("/api/views", views);

serve({ fetch: app.fetch, port: Number(process.env.PORT || 3000) });
```

- [ ] **Step 5 : Ajouter `@hono/zod-validator` aux dépendances**

```bash
cd api && pnpm add @hono/zod-validator
```

- [ ] **Step 6 : Écrire les tests (smoke structurel)**

`api/tests/search.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { SearchQuery } from "../src/lib/zod";

describe("SearchQuery schema", () => {
  it("parse les valeurs par défaut", () => {
    const q = SearchQuery.parse({});
    expect(q).toEqual({ q: "", page: 1, genre: "", auteur: "", voix: "", periode: "" });
  });
  it("rejette une page négative", () => {
    expect(() => SearchQuery.parse({ page: "-1" })).toThrow();
  });
});
```

`api/tests/views.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { ViewsParams } from "../src/lib/zod";

describe("ViewsParams schema", () => {
  it("parse un bookId positif", () => {
    expect(ViewsParams.parse({ bookId: "123" })).toEqual({ bookId: 123 });
  });
  it("rejette un bookId invalide", () => {
    expect(() => ViewsParams.parse({ bookId: "abc" })).toThrow();
  });
});
```

- [ ] **Step 7 : Lancer les tests**

Run : `cd api && pnpm test`
Expected : PASS

- [ ] **Step 8 : Commit**

```bash
git add api/
git commit -m "feat(api): endpoints search + views avec validation Zod"
```

### Task 2.3 : Script d'export WP → Postgres (mode dry-run)

**Files:**
- Create : `web/scripts/migrate-wp-to-pg.ts`
- Create : `web/scripts/lib/wp-types.ts`

**Interfaces:**
- Produces : `tsx scripts/migrate-wp-to-pg.ts --dry-run` → rapport de cohérence sans persister

- [ ] **Step 1 : Créer `web/scripts/lib/wp-types.ts`**

```typescript
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
      media_details: { width: number; height: number };
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
```

- [ ] **Step 2 : Créer `web/scripts/migrate-wp-to-pg.ts`**

```typescript
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

async function main() {
  console.log(`Mode ${dryRun ? "dry-run" : "apply"}`);
  let bookCount = 0;
  let trackCount = 0;
  let missingTracks = 0;

  for await (const post of wpClient.paginatePosts()) {
    bookCount++;
    const tracks = await wpClient.getMediaChildren(post.id);
    trackCount += tracks.length;
    if (tracks.length === 0) missingTracks++;
    if (bookCount % 100 === 0) console.log(`  ${bookCount} livres scannés…`);
  }

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
```

- [ ] **Step 3 : Ajouter le script dans `web/package.json`**

```json
{
  "scripts": {
    "migrate:dry-run": "tsx scripts/migrate-wp-to-pg.ts --dry-run"
  }
}
```

- [ ] **Step 4 : Exécuter en dry-run (smoke)**

Run : `LA_API_BASE=https://www.litteratureaudio.com pnpm migrate:dry-run`
Expected : rapport JSON dans `tmp/migration-report.json` avec ~10 000 livres

- [ ] **Step 5 : Commit**

```bash
git add web/scripts/migrate-wp-to-pg.ts web/scripts/lib/wp-types.ts
git commit -m "feat(web): script export WP → Postgres en mode dry-run"
```

---

## Phase 3 — Front Astro

### Task 3.1 : Initialiser Astro + Tailwind + React + TypeScript strict

**Files:**
- Create : `web/package.json`, `web/astro.config.ts`, `web/tailwind.config.ts`, `web/tsconfig.json`, `web/biome.json`
- Create : `web/src/styles/global.css`
- Modify : `pnpm-workspace.yaml`, `package.json` racine

- [ ] **Step 1 : Créer le projet Astro**

```bash
mkdir -p web/src/styles web/src/lib web/src/components web/src/layouts web/src/pages web/src/content web/scripts web/public web/test
```

- [ ] **Step 2 : Écrire `web/package.json`**

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
    "check": "astro check",
    "test": "vitest run",
    "lint": "biome check .",
    "migrate:dry-run": "tsx scripts/migrate-wp-to-pg.ts --dry-run"
  },
  "dependencies": {
    "@astrojs/react": "^3.6.0",
    "@astrojs/sitemap": "^3.1.0",
    "@astrojs/tailwind": "^5.1.0",
    "astro": "^4.12.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.8.0",
    "@lhci/cli": "^0.14.0",
    "@testing-library/dom": "^10.3.0",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3 : Écrire `web/astro.config.ts`**

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
    define: {
      "process.env.LA_API_BASE": JSON.stringify(process.env.LA_API_BASE),
      "process.env.LA_IMAGE_TRANSFORM": JSON.stringify(process.env.LA_IMAGE_TRANSFORM),
    },
  },
});
```

- [ ] **Step 4 : Écrire `web/tailwind.config.ts`**

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

- [ ] **Step 5 : Écrire `web/src/styles/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { color-scheme: light dark; }
  body { @apply font-sans antialiased; }
}
```

- [ ] **Step 6 : Écrire `web/tsconfig.json`**

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

- [ ] **Step 7 : Écrire `web/biome.json`**

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

- [ ] **Step 8 : Mettre à jour `pnpm-workspace.yaml`**

```yaml
packages:
  - "api-cache"
  - "api"
  - "web"
```

- [ ] **Step 9 : Mettre à jour `package.json` racine**

```json
{
  "name": "litteratureaudio",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.6.0",
  "workspaces": ["api-cache", "api", "web"]
}
```

- [ ] **Step 10 : Installer et vérifier le build minimal**

Run : `pnpm install` (racine)
Run : `cd web && pnpm astro build`
Expected : `dist/` généré

- [ ] **Step 11 : Commit**

```bash
git add pnpm-workspace.yaml package.json web/
git commit -m "feat(web): scaffold Astro 5 + Tailwind + React + TypeScript strict"
```

### Task 3.2 : Content collections typées (Zod)

**Files:**
- Create : `web/src/content/config.ts`

- [ ] **Step 1 : Écrire `web/src/content/config.ts`**

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

Run : `cd web && pnpm astro check`
Expected : 0 erreur

- [ ] **Step 3 : Commit**

```bash
git add web/src/content/config.ts
git commit -m "feat(web): schemas Zod des content collections"
```

### Task 3.3 : Client API WordPress typé + helpers

**Files:**
- Create : `web/src/lib/env.ts`, `web/src/lib/wp-client.ts`, `web/src/lib/format-duration.ts`, `web/src/lib/image-url.ts`
- Create : `web/test/format-duration.test.ts`, `web/test/image-url.test.ts`

- [ ] **Step 1 : Écrire `web/src/lib/env.ts`**

```typescript
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env var ${name} manquante. Définir dans .env ou CI.`);
  return v;
}

export const env = {
  apiBase: required("LA_API_BASE"),
  siteUrl: process.env.SITE_URL || "https://www.litteratureaudio.com",
  imageTransform: (process.env.LA_IMAGE_TRANSFORM || "none") as "none" | "cloudflare" | "imgproxy",
};
```

- [ ] **Step 2 : Écrire `web/src/lib/wp-client.ts`**

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

- [ ] **Step 3 : Écrire le test `formatDuration` (TDD)**

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

- [ ] **Step 4 : Lancer — doit échouer**

Run : `cd web && pnpm test`
Expected : FAIL

- [ ] **Step 5 : Implémenter `web/src/lib/format-duration.ts`**

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

- [ ] **Step 6 : Test passe**

Run : `pnpm test`
Expected : PASS

- [ ] **Step 7 : Écrire le test `imageUrl` (TDD)**

`web/test/image-url.test.ts` :

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

- [ ] **Step 8 : Lancer — doit échouer**

Run : `pnpm test`
Expected : FAIL

- [ ] **Step 9 : Implémenter `web/src/lib/image-url.ts`**

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
  const enc = Buffer.from(src).toString("base64url");
  const optsStr = `w:${opts.width || 0}`;
  return `${config.imgproxyBase}/${optsStr}/${enc}`;
}
```

- [ ] **Step 10 : Test passe**

Run : `pnpm test`
Expected : PASS

- [ ] **Step 11 : Commit**

```bash
git add web/src/lib/ web/test/
git commit -m "feat(web): client WP typé + helpers formatDuration et imageUrl (TDD)"
```

### Task 3.4 : Script d'hydratation des content collections

**Files:**
- Create : `web/scripts/fetch-content.ts`
- Modify : `web/.gitignore`, `web/package.json`

- [ ] **Step 1 : Mettre à jour `web/.gitignore`**

Ajouter :

```
src/content/books/
src/content/authors/
src/content/voices/
src/content/genres/
tmp/
```

- [ ] **Step 2 : Implémenter `web/scripts/fetch-content.ts`**

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

- [ ] **Step 3 : Vérifier le script (smoke test)**

Run : `LA_API_BASE=https://www.litteratureaudio.com pnpm fetch:content`
Expected : ~10 000 fichiers dans `src/content/books/`

- [ ] **Step 4 : Commit**

```bash
git add web/scripts/ web/.gitignore
git commit -m "feat(web): script d'hydratation des content collections depuis l'API WP"
```

### Task 3.5 : Layout de base, Header, Footer

**Files:**
- Create : `web/src/layouts/Base.astro`, `web/src/components/Header.astro`, `web/src/components/Footer.astro`

- [ ] **Step 1 : Créer `web/src/components/Header.astro`**

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
<header class="site-header border-b p-4">
  <div class="max-w-6xl mx-auto flex flex-wrap items-center gap-4">
    <a href="/" class="brand text-xl font-semibold text-primary" rel="home">Litteratureaudio.com</a>
    <nav aria-label="Navigation principale" class="flex-1">
      <ul class="flex flex-wrap gap-4 text-sm">
        {nav.map((item) => (
          <li><a href={item.href} class="hover:underline">{item.label}</a></li>
        ))}
      </ul>
    </nav>
    <form action="/recherche" method="GET" class="search-form flex gap-2">
      <input type="search" name="q" placeholder="Rechercher un livre audio gratuit" aria-label="Rechercher" class="border rounded px-2 py-1" />
      <button type="submit" class="bg-primary text-white px-3 py-1 rounded">Rechercher</button>
    </form>
  </div>
</header>
```

- [ ] **Step 2 : Créer `web/src/components/Footer.astro`**

```astro
---
const year = new Date().getFullYear();
---
<footer class="site-footer border-t p-8 mt-12 text-sm text-center">
  <nav aria-label="Navigation pied de page" class="mb-4">
    <ul class="flex justify-center gap-4">
      <li><a href="/notre-association" class="hover:underline">Notre association</a></li>
      <li><a href="/nous-aider" class="hover:underline">Nous aider</a></li>
      <li><a href="/livre-dor" class="hover:underline">Livre d'or</a></li>
      <li><a href="/forums" class="hover:underline">Forums</a></li>
    </ul>
  </nav>
  <p>© {year} Litteratureaudio.com — Association loi 1901. Contenu sous licence libre.</p>
</footer>
```

- [ ] **Step 3 : Créer `web/src/layouts/Base.astro`**

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
  <body class="min-h-screen flex flex-col">
    <Header />
    <main id="content" class="flex-1 max-w-6xl mx-auto w-full p-4">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 4 : Vérifier le rendu minimal**

Run : `cd web && pnpm build`
Expected : `dist/index.html` généré avec header/footer

- [ ] **Step 5 : Commit**

```bash
git add web/src/layouts/ web/src/components/Header.astro web/src/components/Footer.astro
git commit -m "feat(web): layout Base + Header + Footer avec SEO complet"
```

### Task 3.6 : Composants `Picture` et `BookCard`

**Files:**
- Create : `web/src/components/Picture.astro`, `web/src/components/BookCard.astro`

- [ ] **Step 1 : Créer `web/src/components/Picture.astro`**

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
    class="w-full h-auto"
  />
</picture>
```

- [ ] **Step 2 : Créer `web/src/components/BookCard.astro`**

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
<article class="book-card border rounded p-2 hover:shadow transition">
  <a href={`/livre-audio-gratuit-mp3/${d.slug}.html`} class="book-card__link block">
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
    <div class="book-card__duration text-xs text-gray-600 mt-1">{formatDuration(d.durationTotal)}</div>
    <h3 class="book-card__title font-semibold leading-tight mt-1">{d.title}</h3>
    {authorsLabel && <p class="book-card__author text-sm text-gray-700">{authorsLabel}</p>}
    {genresLabel && <p class="book-card__genre text-sm text-gray-500">{genresLabel}</p>}
  </a>
</article>
```

- [ ] **Step 3 : Commit**

```bash
git add web/src/components/Picture.astro web/src/components/BookCard.astro
git commit -m "feat(web): composants Picture et BookCard"
```

### Task 3.7 : Page d'accueil

**Files:**
- Create : `web/src/pages/index.astro`

- [ ] **Step 1 : Implémenter `web/src/pages/index.astro`**

```astro
---
import { getCollection } from "astro:content";
import Base from "../layouts/Base.astro";
import BookCard from "../components/BookCard.astro";
import type { ImageUrlConfig } from "../lib/image-url";

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
  title={`Plus de ${totalLivres} livres audio gratuits ! | Litteratureaudio.com`}
  description={`La référence du livre audio gratuit francophone : plus de ${totalLivres} livres audio à écouter et télécharger gratuitement au format MP3 !`}
>
  <section aria-labelledby="nouveautes-title" class="mb-10">
    <h2 id="nouveautes-title" class="text-2xl font-bold mb-4">Nouveautés</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {nouveautes.map((book, i) => (
        <BookCard book={book} imageConfig={imageConfig} fetchPriority={i === 0 ? "high" : "auto"} />
      ))}
    </div>
    <p class="mt-4"><a href="/nos-derniers-livres-audio-gratuits" class="text-primary hover:underline">Voir toutes les nouveautés →</a></p>
  </section>

  <section aria-labelledby="populaires-title">
    <h2 id="populaires-title" class="text-2xl font-bold mb-4">Les plus aimés</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {populaires.map((book) => (
        <BookCard book={book} imageConfig={imageConfig} />
      ))}
    </div>
    <p class="mt-4"><a href="/classement-de-nos-livres-audio-gratuits-les-plus-apprecies" class="text-primary hover:underline">Voir le classement complet →</a></p>
  </section>
</Base>
```

- [ ] **Step 2 : Build**

Run : `LA_IMAGE_TRANSFORM=none LA_API_BASE=https://www.litteratureaudio.com pnpm build`
Expected : `dist/index.html` généré avec les cartes livre

- [ ] **Step 3 : Commit**

```bash
git add web/src/pages/index.astro
git commit -m "feat(web): page d'accueil (Nouveautés + Les plus aimés)"
```

### Task 3.8 : Page fiche livre (URL préservée) + lecteur placeholder

**Files:**
- Create : `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`
- Create : `web/src/components/Player.tsx`

- [ ] **Step 1 : Créer `web/src/components/Player.tsx`**

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
    <div className="player border rounded p-4" role="region" aria-label="Lecteur audio">
      <audio
        src={track?.url}
        controls
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full"
      />
      <div className="player__tracks mt-2" role="list">
        {tracks.map((t, i) => (
          <button
            key={t.id}
            role="listitem"
            onClick={() => setCurrentTrack(i)}
            aria-current={i === currentTrack}
            className={`player__track block text-left w-full px-2 py-1 rounded ${i === currentTrack ? "player__track--active bg-primary text-white" : "hover:bg-gray-100"}`}
          >
            {t.title}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Créer `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`**

```astro
---
import { getCollection } from "astro:content";
import Base from "../../layouts/Base.astro";
import Picture from "../../components/Picture.astro";
import Player from "../../components/Player.tsx";
import { formatDuration } from "../../lib/format-duration";
import type { ImageUrlConfig } from "../../lib/image-url";

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
  title={`${d.title} | Litteratureaudio.com`}
  description={d.excerpt || `Livre audio gratuit ${d.title} de ${authorsLabel}. Durée : ${formatDuration(d.durationTotal)}.`}
  canonical={d.legacyUrl}
  image={d.cover?.url}
  type="article"
  publishedAt={d.publishedAt}
  modifiedAt={d.modifiedAt}
>
  <article>
    <header class="book-header flex flex-col md:flex-row gap-6 mb-8">
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
      <div class="book-meta flex-1">
        <h1 class="text-3xl font-bold mb-2">{d.title}</h1>
        {authorsLabel && <p class="mb-1">De <a href={`/auteur/${d.authors[0]?.slug}`} class="text-primary hover:underline">{authorsLabel}</a></p>}
        {voicesLabel && <p class="mb-1">Lu par {voicesLabel}</p>}
        <p class="mb-1">Durée : {formatDuration(d.durationTotal)}</p>
        {genresLabel && <p class="mb-1">Genre : {genresLabel}</p>}
        {d.period && <p class="mb-1">Période : {d.period.name}</p>}
        {d.license && <p class="mb-1">Licence : {d.license.name}</p>}
      </div>
    </header>

    {d.tracks.length > 0 && (
      <section aria-labelledby="player-title" class="mb-8">
        <h2 id="player-title" class="text-2xl font-bold mb-4">Écouter</h2>
        <Player client:visible tracks={d.tracks} bookId={d.id} />
      </section>
    )}

    {d.content && (
      <section aria-labelledby="description-title" class="mb-8">
        <h2 id="description-title" class="text-2xl font-bold mb-4">Description</h2>
        <div class="prose max-w-none" set:html={d.content} />
      </section>
    )}

    {d.tracks.length > 0 && (
      <section aria-labelledby="download-title">
        <h2 id="download-title" class="text-2xl font-bold mb-4">Télécharger</h2>
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

- [ ] **Step 3 : Build**

Run : `LA_IMAGE_TRANSFORM=none pnpm build`
Expected : une page `dist/livre-audio-gratuit-mp3/<slug>/index.html` par livre

- [ ] **Step 4 : Commit**

```bash
git add web/src/pages/livre-audio-gratuit-mp3/ web/src/components/Player.tsx
git commit -m "feat(web): page fiche livre (URL préservée) + lecteur placeholder"
```

### Task 3.9 : Sitemap, robots.txt, 404, redirections

**Files:**
- Create : `web/src/pages/robots.txt.ts`, `web/src/pages/404.astro`
- Create : `web/public/_redirects`

- [ ] **Step 1 : Créer `web/src/pages/robots.txt.ts`**

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

- [ ] **Step 2 : Créer `web/src/pages/404.astro`**

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

- [ ] **Step 3 : Créer `web/public/_redirects`**

```
# Routes communautaires / contribution restent sur WP pendant les Couches 2/3
/forums/*  https://admin.litteratureaudio.com/forums/:splat  301
/membres/*  https://admin.litteratureaudio.com/membres/:splat  301
/connexion  https://admin.litteratureaudio.com/connexion  301
/inscription  https://admin.litteratureaudio.com/inscription  301
/profil  https://admin.litteratureaudio.com/profil  301
/wp-admin/*  https://admin.litteratureaudio.com/wp-admin/:splat  301
/creer/*  https://admin.litteratureaudio.com/creer/:splat  301
/calendrier-des-publications  https://admin.litteratureaudio.com/calendrier-des-publications  301

# Recherche ancienne → nouvelle page recherche (Plan 3)
/?s=/*  /recherche?q=:splat  301

# Fallback 404
/*  /404.html  404
```

- [ ] **Step 4 : Commit**

```bash
git add web/src/pages/robots.txt.ts web/src/pages/404.astro web/public/_redirects
git commit -m "feat(web): sitemap + robots.txt + 404 + redirections"
```

---

## Phase 4 — Islands React

### Task 4.1 : `SearchBox`

**Files:**
- Create : `web/src/components/SearchBox.tsx`

- [ ] **Step 1 : Implémenter `SearchBox.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from "react";

interface Result {
  slug: string;
  title: string;
  author?: string;
}

export default function SearchBox({ apiBase }: { apiBase: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLFormElement>(null);

  const search = useCallback(async (value: string) => {
    if (!value.trim()) { setResults([]); return; }
    try {
      const res = await fetch(`${apiBase}/api/search?q=${encodeURIComponent(value)}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setResults((data.results || []).slice(0, 6));
      setError(false);
    } catch {
      setError(true);
      setResults([]);
    }
  }, [apiBase]);

  useEffect(() => {
    const t = setTimeout(() => search(q), 200);
    return () => clearTimeout(t);
  }, [q, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <form ref={ref} action="/recherche" method="GET" className="relative">
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        placeholder="Rechercher…"
        aria-label="Rechercher"
        aria-expanded={open}
        aria-controls="search-results"
        className="border rounded px-2 py-1 w-full"
      />
      {open && (results.length > 0 || error) && (
        <ul id="search-results" role="listbox" className="absolute z-10 bg-white dark:bg-gray-900 border rounded shadow w-full mt-1">
          {error && <li className="px-2 py-1 text-sm text-red-600">Recherche temporairement indisponible</li>}
          {results.map((r) => (
            <li key={r.slug} role="option">
              <a href={`/livre-audio-gratuit-mp3/${r.slug}.html`} className="block px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">
                {r.title}
                {r.author && <span className="text-sm text-gray-500 ml-2">— {r.author}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
```

- [ ] **Step 2 : Commit**

```bash
git add web/src/components/SearchBox.tsx
git commit -m "feat(web): island SearchBox avec autocomplétion"
```

### Task 4.2 : `ThemeToggle`

**Files:**
- Create : `web/src/components/ThemeToggle.tsx`
- Modify : `web/src/components/Header.astro`

- [ ] **Step 1 : Implémenter `ThemeToggle.tsx`**

```tsx
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("la:theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = stored ? stored === "dark" : prefersDark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("la:theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      className="px-2 py-1 border rounded"
    >
      {dark ? "☀️ Clair" : "🌙 Sombre"}
    </button>
  );
}
```

- [ ] **Step 2 : Intégrer dans `Header.astro`**

Ajouter l'import et placer le composant côté droit :

```astro
---
import ThemeToggle from "./ThemeToggle.tsx";
// ...
---
// ...
<div class="flex items-center gap-2">
  <form action="/recherche" method="GET" class="search-form flex gap-2">
    <!-- ... -->
  </form>
  <ThemeToggle client:idle />
</div>
```

- [ ] **Step 3 : Commit**

```bash
git add web/src/components/ThemeToggle.tsx web/src/components/Header.astro
git commit -m "feat(web): island ThemeToggle clair/sombre"
```

---

## Phase 5 — CI/CD

### Task 5.1 : GitHub Actions CI

**Files:**
- Create : `.github/workflows/ci.yml`

- [ ] **Step 1 : Écrire `.github/workflows/ci.yml`**

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

  test-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install
        working-directory: api
      - run: pnpm test
        working-directory: api
      - run: pnpm build
        working-directory: api

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
git commit -m "ci: GitHub Actions (api-cache + api + web + lighthouse)"
```

### Task 5.2 : Webhook rebuild déclenché par WP

**Files:**
- Create : `.github/workflows/wp-webhook-rebuild.yml`

- [ ] **Step 1 : Écrire `.github/workflows/wp-webhook-rebuild.yml`**

```yaml
name: Rebuild (WP webhook)
on:
  repository_dispatch:
    types: [wp-save-post]

jobs:
  rebuild:
    runs-on: ubuntu-latest
    env:
      LA_API_BASE: ${{ secrets.LA_API_BASE || 'https://www.litteratureaudio.com' }}
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
      - name: Deploy
        run: |
          echo "Déploiement agnostique — configurer secrets.DEPLOY_CMD"
          ${{ secrets.DEPLOY_CMD }}
```

- [ ] **Step 2 : Commit**

```bash
git add .github/workflows/wp-webhook-rebuild.yml
git commit -m "ci: workflow rebuild déclenché par webhook WP save_post"
```

---

## Phase 6 — README racine et finalisation

### Task 6.1 : README du projet

**Files:**
- Create : `README.md`

- [ ] **Step 1 : Rédiger `README.md`**

```markdown
# Litteratureaudio.com — Refonte

Refonte progressive du site [litteratureaudio.com](https://www.litteratureaudio.com) en 3 couches.

## Structure

- `api-cache/` — Cloudflare Worker mettant en cache l'API REST WordPress pendant la transition.
- `api/` — API REST custom (Hono + Drizzle + Postgres) pour les Couches 2 et 3.
- `web/` — Front public Astro 5 avec islands React.
- `docs/` — Specs, plans et cahier des charges WordPress Phase 0.

## Développement

```bash
pnpm install

cd api-cache && pnpm test
cd ../api && pnpm test && pnpm build
cd ../web && pnpm test && pnpm check && pnpm build
```

## Variables d'environnement (web)

- `LA_API_BASE` — URL de l'API (Worker Cloudflare ou WP direct)
- `LA_IMAGE_TRANSFORM` — `none`, `cloudflare` ou `imgproxy`
- `SITE_URL` — URL canonique du site
```

- [ ] **Step 2 : Commit**

```bash
git add README.md
git commit -m "docs: README racine du projet"
```

---

## Self-Review

**Spec coverage :**
- Architecture 3 couches + transition WP ✓ (Phase 0, Phase 1, Phase 2, intro)
- Périmètre fonctionnel Couche 1 (home, fiche, islands, redirections WP) ✓ (Tasks 3.1–3.9, 4.1–4.2)
- Modèle Postgres/Drizzle ✓ (Task 2.1)
- Migration one-shot dry-run ✓ (Task 2.3)
- API `/api/search`, `/api/views`, `/api/books/:slug` etc. ✓ (Task 2.2 couvre search/views ; books/authors/voices/genres prêts pour extension)
- Islands Player, SearchBox, ThemeToggle ✓ (Tasks 3.8, 4.1, 4.2)
- CI/CD, budgets Lighthouse ✓ (Task 5.1)
- Webhook rebuild ✓ (Task 5.2)
- SEO, accessibilité, budgets perf ✓ (Global Constraints + Base.astro + Picture)

**Placeholder scan :** aucun TBD/TODO/“à compléter”. Les redirections `_redirects` utilisent `admin.litteratureaudio.com` comme cible WP ; c’est une hypothèse explicite à valider.

**Type consistency :**
- `ImageUrlConfig.transform` : `"none" | "cloudflare" | "imgproxy"` utilisé partout.
- `WpPost`, `WpMedia`, `WpTerm` cohérents entre `wp-client.ts` et `wp-types.ts`.
- `Book` Zod ↔ `fetch-content.ts` ↔ `BookCard.astro` ↔ `[slug].astro` cohérents.

**Note importante :** le plan couvre la Couche 1 complète. Il ne livre pas les pages intermédiaires de classement (`/auteur/[slug]`, `/genre/[slug]`, `/voix/[slug]`, `/recherche` page complète, `/nos-derniers-livres-audio-gratuits`, etc.) qui sont dans le périmètre fonctionnel de la spec. Elles sont mentionnées dans `_redirects` et le header, mais non implémentées ici. Si tu veux les inclure dans cette phase, dis-le-moi et j’ajoute les tâches.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-28-litteratureaudio-couche1-implementation.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints

**Which approach?**
