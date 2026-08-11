# Catalogue complet (5000) + recherche avancée — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monter le catalogue de ~500 à 5000 livres, ajouter une recherche plein texte (Pagefind) et une recherche avancée multi-critères (index JSON), et corriger les pages de taxonomies qui ne paginent pas statiquement.

**Architecture:** Tout statique. `FETCH_LIMIT=5000` au build. Pagefind indexe les pages livre post-build. Un script génère `search-filters.json` dérivé de la collection. Deux pages de recherche consomment ces index côté client. Les pages `auteur/[slug]` et `voix/[slug]` sont converties en pagination statique `[slug]/[page].astro` sur le modèle de `genre/[slug]/[page].astro`.

**Tech Stack:** Astro 4, React 18 (`client:idle`/`client:visible`), Tailwind, Pagefind (`@pagefind/astro` ou CLI), tsx, Cloudflare Pages, GitHub Actions.

## Global Constraints

- Pas de backend, pas d'auth, pas de runtime SSR. Tout est généré au build.
- `pageUrl()` (`web/src/lib/urls.ts:1`) ajoute `.html` aux paths internes — tous les `href` et `baseUrl` passés à `Pagination`/`Section`/liens doivent passer par `pageUrl()` ou inclure `.html`.
- Pages de taxonomies paginées : `pageSize = 24` (convention existante dans `genre/[slug]/[page].astro:8` et `BookList.astro`).
- Composants React existants utilisent `lucide-react` pour les icônes et Tailwind pour les styles — suivre ce pattern.
- `Base.astro` a déjà `<html lang="fr-FR">` (`Base.astro:21`) — pas besoin d'ajouter `data-pagefind-language`.
- Vérification après chaque tâche : `pnpm exec astro check` (typecheck) + `pnpm build` avec `FETCH_LIMIT=20` (build rapide de fumée). Build complet `FETCH_LIMIT=5000` seulement à la fin.
- Commits fréquents, un par tâche.

## File Structure

| Fichier | Action | Responsabilité |
|---|---|---|
| `web/scripts/fetch-content.ts` | Modifier | Paralléliser fetch (batch Promise.all) |
| `web/src/pages/livre-audio-gratuit-mp3/auteur/[slug].astro` | Modifier | Redirect vers `[slug]/1` |
| `web/src/pages/livre-audio-gratuit-mp3/auteur/[slug]/[page].astro` | Créer | Pagination statique auteur |
| `web/src/pages/livre-audio-gratuit-mp3/voix/[slug].astro` | Modifier | Redirect vers `[slug]/1` |
| `web/src/pages/livre-audio-gratuit-mp3/voix/[slug]/[page].astro` | Créer | Pagination statique voix |
| `web/src/pages/livre-audio-gratuit-mp3/[slug].astro` | Modifier | Attributs Pagefind |
| `web/astro.config.mjs` | Modifier | Intégration Pagefind |
| `web/scripts/generate-search-index.ts` | Créer | Génère `search-filters.json` |
| `web/package.json` | Modifier | Scripts postbuild + dépendance pagefind |
| `web/src/components/SearchBox.tsx` | Créer | UI recherche Pagefind |
| `web/src/pages/recherche.astro` | Modifier | Page recherche plein texte |
| `web/src/components/AdvancedSearch.tsx` | Créer | UI recherche filtres |
| `web/src/pages/recherche-avancee.astro` | Créer | Page recherche avancée |
| `web/src/components/Header.astro` | Modifier | Lien recherche avancée |
| `.github/workflows/*.yml` | Modifier | FETCH_LIMIT=5000 + step Pagefind |

---

### Task 1: Paralléliser fetch-content.ts

**Files:**
- Modify: `web/scripts/fetch-content.ts` (fonction `main`, lignes 95-157)
- Test: build de fumée `FETCH_LIMIT=20 pnpm --filter @la/web run build`

**Interfaces:**
- Consumes: `wpClient.getPosts()`, `wpClient.getStationsByIds()` (signatures existantes inchangées)
- Produces: `src/content/books/*.json` (5000 fichiers au lieu de 500, même format)

- [ ] **Step 1: Lire la fonction main actuelle**

Run: `cat web/scripts/fetch-content.ts` (ou Read tool sur les lignes 90-157)
Identifier la boucle séquentielle qui fetch les posts un par un.

- [ ] **Step 2: Ajouter une fonction `fetchWithConcurrency` avant `main`**

Insérer avant la fonction `main` (autour de la ligne 95) :

```typescript
async function fetchWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    results.push(...await Promise.all(batch.map(fn)));
    process.stdout.write(`  fetched ${Math.min(i + concurrency, items.length)}/${items.length}\r`);
  }
  return results;
}
```

- [ ] **Step 3: Remplacer la boucle séquentielle par fetchWithConcurrency**

Dans `main`, remplacer la boucle `for (const post of posts)` (autour des lignes 100-156) par :

```typescript
const CONCURRENCY = 15;
let written = 0;
await fetchWithConcurrency(posts, CONCURRENCY, async (post) => {
  const slug = normalizeSlug(post.slug);
  // ... logique existante de mapping post → book (lignes 110-152 inchangées)
  await writeFile(join(BOOKS_OUT, `${slug}.json`), JSON.stringify(book, null, 2));
  written++;
});
console.log(`✓ ${written} books written to ${BOOKS_OUT}`);
```

Conserver toute la logique de mapping `tracks`, `termMap`, `extractCover`, etc. — seul le wrapping change.

- [ ] **Step 4: Vérifier le typecheck**

Run: `cd web && pnpm exec astro check`
Expected: PASS, pas de nouvelle erreur.

- [ ] **Step 5: Build de fumée**

Run: `cd web && FETCH_LIMIT=20 pnpm build`
Expected: build réussit, 20 fichiers JSON générés dans `src/content/books/`, pages HTML générées.

- [ ] **Step 6: Commit**

```bash
git add web/scripts/fetch-content.ts
git commit -m "perf(web): parallelize fetch-content with concurrency=15"
```

---

### Task 2: Convertir auteur/[slug] en pagination statique

**Files:**
- Modify: `web/src/pages/livre-audio-gratuit-mp3/auteur/[slug].astro`
- Create: `web/src/pages/livre-audio-gratuit-mp3/auteur/[slug]/[page].astro`
- Test: build de fumée

**Interfaces:**
- Consumes: `getCollection("authors")`, `getCollection("books")`, `BookList`, `Base`
- Produces: routes statiques `/livre-audio-gratuit-mp3/auteur/[slug]/[page].html`

- [ ] **Step 1: Écrire le nouveau fichier `auteur/[slug]/[page].astro`**

Créer `web/src/pages/livre-audio-gratuit-mp3/auteur/[slug]/[page].astro` :

```astro
---
import { getCollection } from "astro:content";
import Base from "../../../../layouts/Base.astro";
import BookList from "../../../../components/BookList.astro";

export async function getStaticPaths() {
  const [authors, allBooks] = await Promise.all([getCollection("authors"), getCollection("books")]);
  const pageSize = 24;
  const paths: { params: { slug: string; page: string }; props: { books: typeof allBooks; currentPage: number; totalPages: number; pageSize: number; authorName: string } }[] = [];

  for (const author of authors) {
    const books = allBooks.filter((b) => b.data.authors.some((a) => a.slug === author.data.slug));
    books.sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
    const totalPages = Math.max(1, Math.ceil(books.length / pageSize));
    for (let i = 0; i < totalPages; i++) {
      paths.push({
        params: { slug: author.data.slug, page: String(i + 1) },
        props: { books, currentPage: i + 1, totalPages, pageSize, authorName: author.data.name },
      });
    }
  }
  return paths;
}

const { books, currentPage, pageSize, authorName } = Astro.props;
const title = `Livres audio de ${authorName} - Page ${currentPage} | Litteratureaudio.com`;
---

<Base
  title={title}
  description={`Écoutez et téléchargez gratuitement les livres audio de ${authorName}.`}
>
  <BookList
    books={books}
    title={`Livres audio de ${authorName}`}
    currentPage={currentPage}
    pageSize={pageSize}
    baseUrl={`/livre-audio-gratuit-mp3/auteur/${Astro.params.slug}`}
  />
</Base>
```

- [ ] **Step 2: Réécrire `auteur/[slug].astro` comme redirect statique**

Remplacer tout le contenu de `web/src/pages/livre-audio-gratuit-mp3/auteur/[slug].astro` par :

```astro
---
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const authors = await getCollection("authors");
  return authors.map((author) => ({ params: { slug: author.data.slug } }));
}

return Astro.redirect(`/livre-audio-gratuit-mp3/auteur/${Astro.params.slug}/1`);
---
```

Note : `Astro.redirect` en static build génère un meta-refresh. Le `_redirects` file gère les 301 proprement — ajouter l'entrée dans `web/public/_redirects` (voir Step 3).

- [ ] **Step 3: Ajouter la redirection 301 dans `_redirects`**

Lire `web/public/_redirects` (créer s'il n'existe pas). Ajouter :

```
/livre-audio-gratuit-mp3/auteur/:slug    /livre-audio-gratuit-mp3/auteur/:slug/1    301
```

- [ ] **Step 4: Vérifier le typecheck**

Run: `cd web && pnpm exec astro check`
Expected: PASS.

- [ ] **Step 5: Build de fumée**

Run: `cd web && FETCH_LIMIT=20 pnpm build`
Expected: build réussit, pages `auteur/[slug]/1.html`, `/2.html` générées pour les auteurs avec >24 livres.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/livre-audio-gratuit-mp3/auteur/ web/public/_redirects
git commit -m "fix(web): static pagination for author pages"
```

---

### Task 3: Convertir voix/[slug] en pagination statique

**Files:**
- Modify: `web/src/pages/livre-audio-gratuit-mp3/voix/[slug].astro`
- Create: `web/src/pages/livre-audio-gratuit-mp3/voix/[slug]/[page].astro`
- Test: build de fumée

**Interfaces:**
- Consumes: `getCollection("voices")`, `getCollection("books")`, `BookList`, `Base`
- Produces: routes statiques `/livre-audio-gratuit-mp3/voix/[slug]/[page].html`

- [ ] **Step 1: Écrire le nouveau fichier `voix/[slug]/[page].astro`**

Créer `web/src/pages/livre-audio-gratuit-mp3/voix/[slug]/[page].astro` :

```astro
---
import { getCollection } from "astro:content";
import Base from "../../../../layouts/Base.astro";
import BookList from "../../../../components/BookList.astro";

export async function getStaticPaths() {
  const [voices, allBooks] = await Promise.all([getCollection("voices"), getCollection("books")]);
  const pageSize = 24;
  const paths: { params: { slug: string; page: string }; props: { books: typeof allBooks; currentPage: number; totalPages: number; pageSize: number; voiceName: string } }[] = [];

  for (const voice of voices) {
    const books = allBooks.filter((b) => b.data.voices.some((v) => v.slug === voice.data.slug));
    books.sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
    const totalPages = Math.max(1, Math.ceil(books.length / pageSize));
    for (let i = 0; i < totalPages; i++) {
      paths.push({
        params: { slug: voice.data.slug, page: String(i + 1) },
        props: { books, currentPage: i + 1, totalPages, pageSize, voiceName: voice.data.name },
      });
    }
  }
  return paths;
}

const { books, currentPage, pageSize, voiceName } = Astro.props;
const title = `Livres audio lus par ${voiceName} - Page ${currentPage} | Litteratureaudio.com`;
---

<Base
  title={title}
  description={`Écoutez et téléchargez gratuitement les livres audio lus par ${voiceName}.`}
>
  <BookList
    books={books}
    title={`Livres audio lus par ${voiceName}`}
    currentPage={currentPage}
    pageSize={pageSize}
    baseUrl={`/livre-audio-gratuit-mp3/voix/${Astro.params.slug}`}
  />
</Base>
```

- [ ] **Step 2: Réécrire `voix/[slug].astro` comme redirect statique**

Remplacer tout le contenu de `web/src/pages/livre-audio-gratuit-mp3/voix/[slug].astro` par :

```astro
---
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const voices = await getCollection("voices");
  return voices.map((voice) => ({ params: { slug: voice.data.slug } }));
}

return Astro.redirect(`/livre-audio-gratuit-mp3/voix/${Astro.params.slug}/1`);
---
```

- [ ] **Step 3: Ajouter la redirection 301 dans `_redirects`**

Ajouter dans `web/public/_redirects` :

```
/livre-audio-gratuit-mp3/voix/:slug    /livre-audio-gratuit-mp3/voix/:slug/1    301
```

- [ ] **Step 4: Vérifier le typecheck**

Run: `cd web && pnpm exec astro check`
Expected: PASS.

- [ ] **Step 5: Build de fumée**

Run: `cd web && FETCH_LIMIT=20 pnpm build`
Expected: build réussit, pages `voix/[slug]/1.html`, `/2.html` générées pour les voix avec >24 livres.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/livre-audio-gratuit-mp3/voix/ web/public/_redirects
git commit -m "fix(web): static pagination for voice pages"
```

---

### Task 4: Intégrer Pagefind au build

**Files:**
- Modify: `web/package.json` (dépendance + script)
- Modify: `web/astro.config.mjs` (si intégration plugin Astro)
- Test: build de fumée + vérification `dist/pagefind/`

**Interfaces:**
- Consumes: `dist/*.html` généré par `astro build`
- Produces: `dist/pagefind/` (index de recherche plein texte)

- [ ] **Step 1: Lire `astro.config.mjs` actuel**

Run: Read tool sur `web/astro.config.mjs`
Identifier la structure (integrations, site, output).

- [ ] **Step 2: Installer la dépendance Pagefind**

Run: `cd web && pnpm add -D pagefind`
Expected: `pagefind` ajouté à `devDependencies` dans `package.json`.

- [ ] **Step 3: Ajouter le script postbuild dans `package.json`**

Modifier `web/package.json`, section `scripts` :

```json
{
  "scripts": {
    "fetch:content": "tsx scripts/fetch-content.ts",
    "prebuild": "pnpm fetch:content",
    "build": "astro build",
    "postbuild": "pagefind --site dist",
    "dev": "astro dev",
    "check": "astro check"
  }
}
```

Note : `postbuild` tourne automatiquement après `build`. Pas besoin de plugin Astro — le CLI Pagefind scanne `dist/` directement.

- [ ] **Step 4: Build de fumée**

Run: `cd web && FETCH_LIMIT=20 pnpm build`
Expected: build réussit, dossier `dist/pagefind/` créé avec fichiers d'index.

- [ ] **Step 5: Vérifier l'index Pagefind**

Run: `ls web/dist/pagefind/`
Expected: fichiers `pagefind.js`, `pagefind-ui.js`, `pf_*` (index segments).

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml
git commit -m "feat(web): integrate Pagefind for static full-text search"
```

---

### Task 5: Ajouter les attributs Pagefind aux pages livre

**Files:**
- Modify: `web/src/pages/livre-audio-gratuit-mp3/[slug].astro` (lignes 75-130)
- Test: build de fumée + vérification index

**Interfaces:**
- Consumes: structure HTML existante de la page livre
- Produces: HTML avec balises `data-pagefind-body`, `data-pagefind-meta`, `data-pagefind-weight`

- [ ] **Step 1: Ajouter `data-pagefind-body` sur l'article**

Dans `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`, ligne 75, modifier :

```astro
<article data-pagefind-body>
```

- [ ] **Step 2: Ajouter `data-pagefind-meta` sur les métadonnées du header**

Dans le header (lignes 92-131), ajouter les attributs meta :

```astro
<h1 class="text-3xl font-bold mb-2" data-pagefind-weight="2">{d.title}</h1>
{authorsLabel && (
  <p class="mb-1" data-pagefind-meta="author" data-pagefind-weight="2">
    De {d.authors.map((a, i) => (
      ...
```

- [ ] **Step 3: Ajouter `data-pagefind-meta` sur durée et genres**

```astro
<p class="mb-1" data-pagefind-meta="duration">{formatDuration(d.durationTotal)}</p>
...
{genresLabel && (
  <p class="mb-1" data-pagefind-meta="genre">
    Genre : {d.genres.map((g, i) => ( ...
```

- [ ] **Step 4: Ajouter `data-pagefind-weight` sur l'excerpt**

Sur la description (ligne 175) :

```astro
<div class="prose max-w-none" set:html={descriptionHtml} data-pagefind-weight="0.5" />
```

- [ ] **Step 5: Vérifier le typecheck**

Run: `cd web && pnpm exec astro check`
Expected: PASS.

- [ ] **Step 6: Build de fumée + vérifier index**

Run: `cd web && FETCH_LIMIT=20 pnpm build`
Vérifier : `ls web/dist/pagefind/` présent. Optionnel : `npx pagefind --site dist --verbose` pour voir le nombre de pages indexées.

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/livre-audio-gratuit-mp3/[slug].astro
git commit -m "feat(web): add Pagefind index attributes to book pages"
```

---

### Task 6: Créer le script generate-search-index.ts

**Files:**
- Create: `web/scripts/generate-search-index.ts`
- Modify: `web/package.json` (script postbuild)
- Test: exécution manuelle + vérification JSON

**Interfaces:**
- Consumes: `src/content/books/*.json` (fichiers générés par fetch-content)
- Produces: `dist/search-filters.json` (index pour recherche filtres)

- [ ] **Step 1: Créer le script**

Créer `web/scripts/generate-search-index.ts` :

```typescript
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
```

- [ ] **Step 2: Mettre à jour le script postbuild dans `package.json`**

Modifier `web/package.json` :

```json
{
  "scripts": {
    "postbuild": "pagefind --site dist && tsx scripts/generate-search-index.ts"
  }
}
```

- [ ] **Step 3: Exécuter le script manuellement**

Run: `cd web && pnpm exec tsx scripts/generate-search-index.ts`
Expected: `✓ N entries written to dist/search-filters.json`.

- [ ] **Step 4: Vérifier le JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('web/dist/search-filters.json')); console.log('valid')"`
Expected: `valid`.

Vérifier la taille :
Run: `ls -lh web/dist/search-filters.json`
Expected: < 3MB pour 5000 entrées (avec 20 entrées en test, < 50KB).

- [ ] **Step 5: Commit**

```bash
git add web/scripts/generate-search-index.ts web/package.json
git commit -m "feat(web): add search-filters.json generator script"
```

---

### Task 7: Créer le composant SearchBox (Pagefind)

**Files:**
- Create: `web/src/components/SearchBox.tsx`
- Test: typecheck

**Interfaces:**
- Consumes: `/pagefind/pagefind.js` (module importé dynamiquement)
- Produces: composant React `SearchBox` exporté par défaut

- [ ] **Step 1: Créer le composant**

Créer `web/src/components/SearchBox.tsx` :

```tsx
import { useState, useRef, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";

interface PagefindResult {
  id: string;
  data: () => Promise<{
    meta: { title?: string; author?: string; duration?: string; url: string };
    excerpt: string;
  }>;
  url: string;
}

interface PagefindModule {
  search: (query: string) => Promise<{ results: PagefindResult[] }>;
}

let pagefind: PagefindModule | null = null;

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ title: string; author?: string; duration?: string; url: string; excerpt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadPagefind = useCallback(async () => {
    if (pagefind) return pagefind;
    try {
      pagefind = await import(/* @vite-ignore */ "/pagefind/pagefind.js");
      setLoaded(true);
      return pagefind;
    } catch {
      return null;
    }
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const pf = await loadPagefind();
    if (!pf) {
      setLoading(false);
      return;
    }
    try {
      const { results: raw } = await pf.search(q);
      const enriched = await Promise.all(
        raw.slice(0, 30).map(async (r) => {
          const data = await r.data();
          return {
            title: data.meta.title || "(sans titre)",
            author: data.meta.author,
            duration: data.meta.duration,
            url: r.url,
            excerpt: data.excerpt,
          };
        })
      );
      setResults(enriched);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [loadPagefind]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 300);
  };

  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="search"
            value={query}
            onChange={onChange}
            onFocus={loadPagefind}
            placeholder="Recherchez parmi 5000+ livres audio gratuits"
            className="w-full border rounded pl-10 pr-3 py-2"
            aria-label="Rechercher"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" size={18} />}
        </div>
      </form>

      {!query && loaded && <p className="text-gray-600">Tapez un mot-clé pour rechercher dans le contenu des livres audio.</p>}

      {query && !loading && results.length === 0 && loaded && (
        <p className="text-gray-600">Aucun résultat pour « {query} ».</p>
      )}

      {query && !loaded && !loading && (
        <p className="text-gray-600">Index de recherche indisponible. Réessayez plus tard.</p>
      )}

      <ul className="space-y-3">
        {results.map((r, i) => (
          <li key={i}>
            <a href={r.url} className="block border rounded p-3 hover:shadow transition">
              <p className="font-medium">{r.title}</p>
              {r.author && <p className="text-sm text-gray-600">{r.author}</p>}
              {r.duration && <p className="text-xs text-gray-500">{r.duration}</p>}
              <p className="text-sm text-gray-600 mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: r.excerpt }} />
            </a>
          </li>
        ))}
      </ul>

      {results.length > 0 && (
        <p className="text-sm text-gray-500">
          <a href="/recherche-avancee.html" className="text-primary hover:underline">Recherche par filtres →</a>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd web && pnpm exec astro check`
Expected: PASS. (Peut afficher un warning sur l'import dynamique `/pagefind/pagefind.js` — acceptable, le module n'existe qu'au runtime après build.)

- [ ] **Step 3: Commit**

```bash
git add web/src/components/SearchBox.tsx
git commit -m "feat(web): add SearchBox component using Pagefind"
```

---

### Task 8: Réécrire la page /recherche

**Files:**
- Modify: `web/src/pages/recherche.astro`
- Test: build de fumée

**Interfaces:**
- Consumes: `SearchBox` (Task 7), `Base`
- Produces: page `/recherche.html` avec recherche plein texte

- [ ] **Step 1: Réécrire `recherche.astro`**

Remplacer tout le contenu de `web/src/pages/recherche.astro` par :

```astro
---
import Base from "../layouts/Base.astro";
import SearchBox from "../components/SearchBox";
---

<Base title="Recherche | Litteratureaudio.com" description="Recherchez parmi plus de 5000 livres audio gratuits.">
  <h1 class="text-2xl font-bold mb-4">Recherche</h1>
  <SearchBox client:idle />
  <p class="mt-6 text-sm text-gray-600">
    <a href="/recherche-avancee.html" class="text-primary hover:underline">Recherche avancée par filtres →</a>
  </p>
</Base>
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd web && pnpm exec astro check`
Expected: PASS.

- [ ] **Step 3: Build de fumée**

Run: `cd web && FETCH_LIMIT=20 pnpm build`
Expected: build réussit, `dist/recherche.html` généré, `dist/pagefind/` présent.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/recherche.astro
git commit -m "feat(web): rewrite /recherche with Pagefind full-text search"
```

---

### Task 9: Créer le composant AdvancedSearch (filtres JSON)

**Files:**
- Create: `web/src/components/AdvancedSearch.tsx`
- Test: typecheck

**Interfaces:**
- Consumes: `/search-filters.json` (fetch runtime)
- Produces: composant React `AdvancedSearch` exporté par défaut

- [ ] **Step 1: Créer le composant**

Créer `web/src/components/AdvancedSearch.tsx` :

```tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, RotateCcw } from "lucide-react";

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

const PAGE_SIZE = 20;

function parseQueryString(): { genres: string[]; voices: string[]; authors: string[]; dureeMin: number; dureeMax: number } {
  const params = new URLSearchParams(window.location.search);
  const genres = params.get("genres")?.split(",").filter(Boolean) || [];
  const voices = params.get("voix")?.split(",").filter(Boolean) || [];
  const authors = params.get("auteurs")?.split(",").filter(Boolean) || [];
  const duree = params.get("duree");
  let dureeMin = 0;
  let dureeMax = 0;
  if (duree) {
    const [min, max] = duree.split("-").map(Number);
    if (!Number.isNaN(min)) dureeMin = min;
    if (!Number.isNaN(max)) dureeMax = max;
  }
  return { genres, voices, authors, dureeMin, dureeMax };
}

export default function AdvancedSearch() {
  const [entries, setEntries] = useState<FilterEntry[]>([]);
  const [error, setError] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [voices, setVoices] = useState<string[]>([]);
  const [authors, setAuthors] = useState<string[]>([]);
  const [dureeMin, setDureeMin] = useState(0);
  const [dureeMax, setDureeMax] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch("/search-filters.json", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: FilterEntry[]) => {
        setEntries(data);
        const initial = parseQueryString();
        setGenres(initial.genres);
        setVoices(initial.voices);
        setAuthors(initial.authors);
        setDureeMin(initial.dureeMin);
        setDureeMax(initial.dureeMax);
      })
      .catch(() => setError(true))
      .finally(() => clearTimeout(timeout));
  }, []);

  const allGenres = useMemo(() => [...new Set(entries.flatMap((e) => e.g))].sort(), [entries]);
  const allVoices = useMemo(() => [...new Set(entries.flatMap((e) => e.v))].sort(), [entries]);
  const allAuthors = useMemo(() => [...new Set(entries.flatMap((e) => e.a))].sort(), [entries]);
  const maxDuration = useMemo(() => Math.max(0, ...entries.map((e) => e.d)), [entries]);

  const filtered = useMemo(() => {
    let result = entries;
    if (genres.length) result = result.filter((e) => genres.some((g) => e.g.includes(g)));
    if (voices.length) result = result.filter((e) => voices.some((v) => e.v.includes(v)));
    if (authors.length) result = result.filter((e) => authors.some((a) => e.a.includes(a)));
    if (dureeMax > 0) result = result.filter((e) => e.d >= dureeMin && e.d <= dureeMax);
    return result.sort((a, b) => b.w - a.w);
  }, [entries, genres, voices, authors, dureeMin, dureeMax]);

  useEffect(() => {
    setPage(0);
  }, [genres, voices, authors, dureeMin, dureeMax]);

  const syncUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (genres.length) params.set("genres", genres.join(","));
    if (voices.length) params.set("voix", voices.join(","));
    if (authors.length) params.set("auteurs", authors.join(","));
    if (dureeMax > 0) params.set("duree", `${dureeMin}-${dureeMax}`);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [genres, voices, authors, dureeMin, dureeMax]);

  useEffect(() => { syncUrl(); }, [syncUrl]);

  const reset = () => {
    setGenres([]);
    setVoices([]);
    setAuthors([]);
    setDureeMin(0);
    setDureeMax(0);
  };

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (slug: string) => {
    setter((prev) => prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]);
  };

  const pageResults = filtered.slice(0, (page + 1) * PAGE_SIZE);

  if (error) {
    return <p className="text-gray-600">Filtres indisponibles. Réessayez plus tard.</p>;
  }

  if (entries.length === 0) {
    return <p className="text-gray-600">Chargement des filtres…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <fieldset>
          <legend className="font-medium mb-2">Genres</legend>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {allGenres.map((g) => (
              <button
                key={g}
                onClick={() => toggle(setGenres)(g)}
                className={`px-2 py-1 text-sm rounded border ${genres.includes(g) ? "bg-primary text-white border-primary" : "hover:bg-gray-100"}`}
              >
                {g}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-medium mb-2">Voix</legend>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {allVoices.map((v) => (
              <button
                key={v}
                onClick={() => toggle(setVoices)(v)}
                className={`px-2 py-1 text-sm rounded border ${voices.includes(v) ? "bg-primary text-white border-primary" : "hover:bg-gray-100"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-medium mb-2">Auteurs</legend>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {allAuthors.map((a) => (
              <button
                key={a}
                onClick={() => toggle(setAuthors)(a)}
                className={`px-2 py-1 text-sm rounded border ${authors.includes(a) ? "bg-primary text-white border-primary" : "hover:bg-gray-100"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-medium mb-2">Durée (minutes)</legend>
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={maxDuration} value={dureeMin || ""} onChange={(e) => setDureeMin(Number(e.target.value) || 0)} placeholder="min" className="w-20 border rounded px-2 py-1" />
            <span>—</span>
            <input type="number" min={0} max={maxDuration} value={dureeMax || ""} onChange={(e) => setDureeMax(Number(e.target.value) || 0)} placeholder="max" className="w-20 border rounded px-2 py-1" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Max : {Math.round(maxDuration / 60)} min</p>
        </fieldset>
      </div>

      <button onClick={reset} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-primary">
        <RotateCcw size={14} /> Réinitialiser
      </button>

      <p className="text-sm text-gray-600">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {pageResults.map((e) => (
          <a key={e.s} href={`/livre-audio-gratuit-mp3/${e.s}.html`} className="block border rounded p-3 hover:shadow transition">
            <p className="font-medium text-sm truncate">{e.t}</p>
            <p className="text-xs text-gray-600 truncate">{e.a.join(", ") || "—"}</p>
            <p className="text-xs text-gray-500">{Math.round(e.d / 60)} min</p>
          </a>
        ))}
      </div>

      {pageResults.length < filtered.length && (
        <button onClick={() => setPage((p) => p + 1)} className="block mx-auto px-4 py-2 border rounded hover:bg-gray-100">
          Charger plus
        </button>
      )}

      <p className="text-sm text-gray-500">
        <a href="/recherche.html" className="text-primary hover:underline">Recherche plein texte →</a>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd web && pnpm exec astro check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AdvancedSearch.tsx
git commit -m "feat(web): add AdvancedSearch component with JSON filters"
```

---

### Task 10: Créer la page /recherche-avancee

**Files:**
- Create: `web/src/pages/recherche-avancee.astro`
- Test: build de fumée

**Interfaces:**
- Consumes: `AdvancedSearch` (Task 9), `Base`
- Produces: page `/recherche-avancee.html`

- [ ] **Step 1: Créer la page**

Créer `web/src/pages/recherche-avancee.astro` :

```astro
---
import Base from "../layouts/Base.astro";
import AdvancedSearch from "../components/AdvancedSearch";
---

<Base title="Recherche avancée | Litteratureaudio.com" description="Recherchez par genre, auteur, voix, durée parmi 5000+ livres audio gratuits.">
  <h1 class="text-2xl font-bold mb-4">Recherche avancée</h1>
  <AdvancedSearch client:idle />
</Base>
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd web && pnpm exec astro check`
Expected: PASS.

- [ ] **Step 3: Build de fumée**

Run: `cd web && FETCH_LIMIT=20 pnpm build`
Expected: build réussit, `dist/recherche-avancee.html` généré, `dist/search-filters.json` présent.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/recherche-avancee.astro
git commit -m "feat(web): add /recherche-avancee page"
```

---

### Task 11: Mettre à jour la navigation

**Files:**
- Modify: `web/src/components/Header.astro` (lien recherche avancée)
- Test: typecheck

**Interfaces:**
- Consumes: `pageUrl()`
- Produces: lien vers `/recherche-avancee` dans le header

- [ ] **Step 1: Ajouter le lien recherche avancée dans le header**

Dans `web/src/components/Header.astro`, après le formulaire de recherche (ligne 26), ajouter dans le `<nav>` :

```astro
<nav aria-label="Navigation principale" class="flex items-center gap-3 text-sm">
  <a href={pageUrl("/recherche-avancee")} class="text-gray-600 hover:text-primary">Avancée</a>
  <a href="#" class="text-gray-600 hover:text-primary" aria-label="Favoris">
    ...
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd web && pnpm exec astro check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Header.astro
git commit -m "feat(web): add advanced search link to header"
```

---

### Task 12: Mettre à jour le workflow GitHub Actions

**Files:**
- Modify: `.github/workflows/*.yml` (workflow de build/déploiement)
- Test: lecture du fichier modifié

**Interfaces:**
- Consumes: variables GitHub `FETCH_LIMIT`, `SITE_URL`, etc.
- Produces: workflow avec `FETCH_LIMIT=5000` + step Pagefind

- [ ] **Step 1: Identifier le workflow de build**

Run: `ls .github/workflows/`
Identifier le fichier qui build le site Astro (généralement `deploy.yml` ou `build.yml`).

- [ ] **Step 2: Mettre à jour `FETCH_LIMIT`**

Dans le job de build web, trouver la variable `FETCH_LIMIT` (ou l'ajouter au step `pnpm build`) :

```yaml
env:
  FETCH_LIMIT: "5000"
  WP_PROXY_URL: ${{ vars.WP_PROXY_URL }}
  SITE_URL: ${{ vars.SITE_URL }}
```

- [ ] **Step 3: Vérifier que le step `postbuild` tourne**

Le script `postbuild` (Pagefind + generate-search-index) tourne automatiquement après `pnpm build`. Vérifier que le workflow appelle bien `pnpm build` (pas `astro build` directement) pour que `prebuild` (fetch-content) et `postbuild` s'exécutent.

Si le workflow appelle `astro build` directement, remplacer par :
```yaml
- run: pnpm --filter @la/web run build
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/
git commit -m "ci: set FETCH_LIMIT=5000 for full catalogue build"
```

---

### Task 13: Build complet de validation

**Files:**
- Aucun fichier modifié — validation uniquement

**Interfaces:**
- Consumes: tout le pipeline (Tasks 1-12)
- Produces: build `dist/` complet à 5000 livres

- [ ] **Step 1: Lancer le build complet**

Run: `cd web && FETCH_LIMIT=5000 pnpm build`
Expected: build réussit. Noter le temps total.

- [ ] **Step 2: Vérifier le nombre de fichiers générés**

Run: `find web/dist -type f | wc -l`
Expected: ~7000-8000 fichiers. Si > 20000, réduire `FETCH_LIMIT`.

- [ ] **Step 3: Vérifier Pagefind**

Run: `ls web/dist/pagefind/`
Expected: dossier non vide.

- [ ] **Step 4: Vérifier search-filters.json**

Run: `ls -lh web/dist/search-filters.json`
Expected: fichier présent, < 3MB.

- [ ] **Step 5: Vérifier les pages de taxonomies**

Run: `ls web/dist/livre-audio-gratuit-mp3/auteur/ | head -20`
Expected: dossiers par slug, chacun contenant `/1.html`, `/2.html` etc.

- [ ] **Step 6: Vérifier la régression lecteur audio**

Ouvrir `web/dist/livre-audio-gratuit-mp3/[un-slug]/index.html` dans un navigateur. Vérifier que le lecteur audio et le bouton de téléchargement fonctionnent.

- [ ] **Step 7: Commit final (si corrections mineures)**

Si le build révèle des corrections mineures (pagination cassée, page vide), corriger et committer :

```bash
git add -A
git commit -m "fix(web): post-build validation corrections"
```

- [ ] **Step 8: Push**

```bash
git push
```

---

## Self-Review

### Spec coverage

| Spec section | Task(s) | Status |
|---|---|---|
| Pipeline de build & volume (5000) | Task 1, 12, 13 | ✅ |
| Indexation Pagefind (pages livre) | Task 4, 5 | ✅ |
| Index JSON filtres | Task 6 | ✅ |
| Page /recherche (plein texte) | Task 7, 8 | ✅ |
| Page /recherche-avancee (filtres) | Task 9, 10 | ✅ |
| Navigation | Task 11 | ✅ |
| Taxonomies & pagination | Task 2, 3 | ✅ |
| Performance build & déploiement | Task 12, 13 | ✅ |
| Testing & validation | Task 13 | ✅ |

### Placeholder scan

Aucun "TBD", "TODO", "add appropriate" trouvé. Toutes les étapes contiennent du code complet.

### Type consistency

- `FilterEntry` (Task 6, 9) : mêmes champs `s, t, a, v, g, p, r, l, d, w` ✅
- `BookList` props (Task 2, 3) : `books, title, currentPage, pageSize, baseUrl` ✅
- `pageUrl()` usage : tous les `href` passent par `pageUrl()` ou `.html` direct ✅

## Revision History

| Rev | Date | Description | Author |
|---|---|---|---|
| 1 | 2026-08-11 | Initial plan. 13 tasks : fetch parallelization, static pagination, Pagefind, search-filters.json, recherche pages, navigation, CI, validation. | elarif |