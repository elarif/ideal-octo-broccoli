# Consolidation globale du clone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le clone d’un assemblage itératif en un site cohérent avec un mini design system, des helpers partagés, une accessibilité correcte et une pagination statique fonctionnelle.

**Architecture:** On crée une couche `lib/urls.ts` et `lib/audio-book.ts`, un mini design system sous `components/ui/`, et on refactorise progressivement les pages et composants existants pour utiliser ces abstractions. On remplace la pagination `?page` par des routes Astro statiques `[...page].astro`.

**Tech Stack:** Astro 4, React 18, Tailwind CSS 3, TypeScript strict.

## Global Constraints

- Les URLs de pages générées doivent rester compatibles avec le déploiement statique Cloudflare Pages (fichiers `.html`).
- Tout lien interne vers une page Astro doit utiliser `pageUrl()` de `lib/urls.ts`.
- Aucune régression fonctionnelle : le lecteur audio, les taxonomies, les fiches et les listes doivent continuer de marcher.
- Pas de changement de structure de données (`content/config.ts`) ni de scripts de fetch.
- `astro check` à 0 erreur et build réussi après chaque task.

---

### Task 1: Créer `lib/urls.ts` et uniformiser les liens internes

**Files:**
- Create: `web/src/lib/urls.ts`
- Modify: `web/src/components/Header.astro`, `web/src/components/Sidebar.astro`, `web/src/components/Footer.astro`, `web/src/components/BookCard.astro`, `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`, `web/src/components/AlphabeticalIndex.astro`, `web/src/pages/notre-bibliotheque-de-livres-audio-gratuits.astro`

**Interfaces:**
- Produces: `export function pageUrl(path: string): string`

- [ ] **Step 1: Create the helper**

  ```ts
  // web/src/lib/urls.ts
  export function pageUrl(path: string): string {
    if (path.startsWith("http") || path.startsWith("#") || path.startsWith("mailto:")) return path;
    const clean = path.replace(/^\//, "").replace(/\.html$/i, "");
    if (!clean) return "/";
    return `/${clean}.html`;
  }
  ```

- [ ] **Step 2: Replace hard-coded links in Header, Sidebar, Footer**

  In each component, add:

  ```astro
  import { pageUrl } from "../lib/urls";
  ```

  and wrap internal `href` values with `pageUrl(...)`.

  Examples:
  - `href="/recherche"` → `href={pageUrl("/recherche")}`
  - `href="/nous-aider"` → `href={pageUrl("/nous-aider")}`
  - `href="/notre-association"` → `href={pageUrl("/notre-association")}`
  - sidebar menu items: change the data structure to compute `href={pageUrl(item.href)}` when `item.href` is truthy.

- [ ] **Step 3: Update BookCard, fiche livre, AlphabeticalIndex, genre page**

  Use `pageUrl` for all internal links:
  - `BookCard.astro`: `href={pageUrl(`/livre-audio-gratuit-mp3/${d.slug}`)}`
  - `[slug].astro`: author/voice/genre links and recommendation links
  - `AlphabeticalIndex.astro`: `href={pageUrl(`${baseUrl}/${item.slug}`)}`
  - `notre-bibliotheque-de-livres-audio-gratuits.astro`: genre links

- [ ] **Step 4: Run astro check**

  Run: `cd /home/elarif/litteratureaudio/web && npx astro check`
  Expected: 0 errors.

- [ ] **Step 5: Build**

  Run: `cd /home/elarif/litteratureaudio/web && WP_API_BASE=https://www.litteratureaudio.com FETCH_LIMIT=50 pnpm --filter @la/web run build`
  Expected: Complete.

- [ ] **Step 6: Commit**

  ```bash
  git add web/src/lib/urls.ts web/src/components/Header.astro web/src/components/Sidebar.astro web/src/components/Footer.astro web/src/components/BookCard.astro web/src/pages/livre-audio-gratuit-mp3/[slug].astro web/src/components/AlphabeticalIndex.astro web/src/pages/notre-bibliotheque-de-livres-audio-gratuits.astro
  git commit -m "refactor(web): introduce pageUrl helper and unify internal links"
  ```

---

### Task 2: Extraire `toAudioBook` dans `lib/audio-book.ts`

**Files:**
- Create: `web/src/lib/audio-book.ts`
- Modify: `web/src/components/BookCard.astro`, `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`

**Interfaces:**
- Consumes: `CollectionEntry<"books">` type, `AudioBook` type.
- Produces: `export function toAudioBook(book: CollectionEntry<"books">): AudioBook`

- [ ] **Step 1: Create the helper**

  ```ts
  // web/src/lib/audio-book.ts
  import type { CollectionEntry } from "astro:content";
  import type { AudioBook } from "../types/audio";

  export function toAudioBook(book: CollectionEntry<"books">): AudioBook {
    const d = book.data;
    return {
      slug: d.slug,
      title: d.title,
      authorsLabel: d.authors.map((a) => a.name).join(", "),
      coverUrl: d.cover?.url,
      tracks: d.tracks.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        url: t.url,
        duration: t.duration,
      })),
    };
  }
  ```

- [ ] **Step 2: Replace duplication in BookCard and [slug].astro**

  In both files, replace the inline `audioBook` construction with:

  ```astro
  import { toAudioBook } from "../../lib/audio-book";
  const audioBook = toAudioBook(book);
  ```

- [ ] **Step 3: Verify imports**

  Remove now-unused imports of `formatDuration`, `formatViews` or other helpers if only kept for the removed code.

- [ ] **Step 4: Run astro check + build**

  Same commands as Task 1.

- [ ] **Step 5: Commit**

  ```bash
  git add web/src/lib/audio-book.ts web/src/components/BookCard.astro web/src/pages/livre-audio-gratuit-mp3/[slug].astro
  git commit -m "refactor(web): extract toAudioBook helper"
  ```

---

### Task 3: Créer le mini design system

**Files:**
- Create: `web/src/components/ui/Section.astro`, `web/src/components/ui/Button.astro`, `web/src/components/ui/IconButton.astro`, `web/src/components/ui/BookGrid.astro`, `web/src/components/CompactBookCard.astro`

**Interfaces:**
- `Section.astro`: Props `{ title?: string; action?: { href: string; label: string }; class?: string }`
- `Button.astro`: Props `{ href?: string; variant?: "primary" | "ghost" | "link"; class?: string }` (slot children)
- `IconButton.astro`: Props `{ variant?: "primary" | "ghost"; class?: string; label: string }` (slot = icon)
- `BookGrid.astro`: Props `{ class?: string }` (slot = items)
- `CompactBookCard.astro`: Props `{ book: CollectionEntry<"books"> }`

- [ ] **Step 1: Create Section.astro**

  ```astro
  ---
  import { pageUrl } from "../../lib/urls";

  interface Props {
    title?: string;
    action?: { href: string; label: string };
    class?: string;
  }
  const { title, action, class: cls = "" } = Astro.props;
  ---
  <section class={`mb-10 ${cls}`}>
    {(title || action) && (
      <div class="flex items-baseline justify-between mb-4">
        {title && <h2 class="text-2xl font-bold">{title}</h2>}
        {action && (
          <a href={pageUrl(action.href)} class="inline-flex items-center gap-1 text-sm font-semibold text-[#2c4cb8] hover:text-[#1a3070] hover:underline">
            {action.label}
            <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
    )}
    <slot />
  </section>
  ```

- [ ] **Step 2: Create Button.astro**

  ```astro
  ---
  import { pageUrl } from "../../lib/urls";

  type Variant = "primary" | "ghost" | "link";
  interface Props {
    href?: string;
    variant?: Variant;
    class?: string;
  }
  const { href, variant = "primary", class: cls = "" } = Astro.props;

  const base = "inline-flex items-center justify-center rounded transition";
  const styles: Record<Variant, string> = {
    primary: "bg-primary text-white hover:bg-primary/90 px-4 py-2",
    ghost: "text-gray-600 hover:text-primary hover:bg-gray-100 p-2",
    link: "text-primary hover:underline px-0 py-0",
  };
  const classes = `${base} ${styles[variant]} ${cls}`;
  ---
  {href ? (
    <a href={pageUrl(href)} class={classes}><slot /></a>
  ) : (
    <button type="button" class={classes}><slot /></button>
  )}
  ```

- [ ] **Step 3: Create IconButton.astro**

  ```astro
  ---
  interface Props {
    variant?: "primary" | "ghost";
    class?: string;
    label: string;
  }
  const { variant = "primary", class: cls = "", label } = Astro.props;
  const base = "inline-flex items-center justify-center rounded-full transition";
  const styles = {
    primary: "bg-primary text-white hover:bg-primary/90",
    ghost: "text-gray-600 hover:text-primary hover:bg-gray-100",
  };
  ---
  <button type="button" aria-label={label} class={`${base} ${styles[variant]} ${cls}`}><slot /></button>
  ```

- [ ] **Step 4: Create BookGrid.astro**

  ```astro
  ---
  interface Props {
    class?: string;
  }
  const { class: cls = "" } = Astro.props;
  ---
  <div class={`grid grid-cols-2 md:grid-cols-4 gap-4 ${cls}`}>
    <slot />
  </div>
  ```

- [ ] **Step 5: Create CompactBookCard.astro**

  ```astro
  ---
  import type { CollectionEntry } from "astro:content";
  import { pageUrl } from "../lib/urls";
  import { formatDuration } from "../lib/format-duration";
  import { formatViews } from "../lib/format-views";

  interface Props {
    book: CollectionEntry<"books">;
  }
  const { book } = Astro.props;
  const d = book.data;
  ---
  <a href={pageUrl(`/livre-audio-gratuit-mp3/${d.slug}`)} class="flex gap-3 p-2 border rounded hover:shadow transition">
    {d.cover && (
      <img src={d.cover.url} alt={d.cover.alt || d.title} loading="lazy" decoding="async" class="w-16 h-20 object-cover rounded flex-shrink-0" />
    )}
    <div class="min-w-0">
      <h3 class="font-semibold text-sm leading-tight truncate">{d.title}</h3>
      <p class="text-xs text-gray-600 mt-1">{formatDuration(d.durationTotal)}</p>
      {d.views > 0 && <p class="text-xs text-gray-500">{formatViews(d.views)} écoutes</p>}
    </div>
  </a>
  ```

- [ ] **Step 6: Run astro check + build**

- [ ] **Step 7: Commit**

  ```bash
  git add web/src/components/ui web/src/components/CompactBookCard.astro
  git commit -m "feat(web): add minimal design system components"
  ```

---

### Task 4: Refactorer BookCard (bouton Play hors du lien)

**Files:**
- Modify: `web/src/components/BookCard.astro`

**Interfaces:**
- Consumes: `toAudioBook`, `pageUrl`, `IconButton.astro`.
- Produces: `BookCard` avec bouton Play accessible, hors du lien.

- [ ] **Step 1: Update imports**

  ```astro
  import { pageUrl } from "../lib/urls";
  import { toAudioBook } from "../lib/audio-book";
  import IconButton from "./ui/IconButton.astro";
  ```

- [ ] **Step 2: Rewrite markup**

  ```astro
  ---
  // ... existing setup
  const audioBook = toAudioBook(book);
  ---

  <article class="border rounded overflow-hidden hover:shadow transition group relative">
    <a href={pageUrl(`/livre-audio-gratuit-mp3/${d.slug}`)} class="block">
      <figure class="relative aspect-[3/4] overflow-hidden bg-gray-100">
        {d.cover && (
          <img
            src={d.cover.url}
            width={d.cover.width}
            height={d.cover.height}
            alt={d.cover.alt || d.title}
            loading="lazy"
            decoding="async"
            class="w-full h-full object-cover"
          />
        )}
        <span class="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {formatDuration(d.durationTotal)}
        </span>
        {d.views > 0 && (
          <span class="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            ▶ {formatViews(d.views)}
          </span>
        )}
      </figure>
      <div class="p-3">
        <h3 class="font-semibold leading-tight">{d.title}</h3>
        {authorsLabel && <p class="text-sm text-gray-700 mt-1">{authorsLabel}</p>}
      </div>
    </a>
    <div class="absolute top-2 left-2 z-10">
      <PlayButton client:visible book={audioBook} className="w-10 h-10 shadow opacity-60 hover:opacity-100" />
    </div>
  </article>
  ```

  Note: `PlayButton` is a React component and remains an island. The wrapping `div` with `z-10` keeps it visually above the link and prevents the invalid nested-button-inside-anchor pattern from an accessibility perspective, because the React island renders the button as a sibling in the final DOM even though source-order places it inside the article.

- [ ] **Step 3: Run astro check + build**

- [ ] **Step 4: Commit**

  ```bash
  git add web/src/components/BookCard.astro
  git commit -m "refactor(web): move BookCard play button outside the card link"
  ```

---

### Task 5: Refactorer la fiche livre avec les nouveaux composants

**Files:**
- Modify: `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`

**Interfaces:**
- Consumes: `Section.astro`, `CompactBookCard.astro`, `pageUrl`.

- [ ] **Step 1: Update imports and use CompactBookCard for recommendations**

  Replace the duplicated inline recommendation cards with `CompactBookCard`.

  Example for the “Lu par” section:

  ```astro
  import Section from "../../components/ui/Section.astro";
  import CompactBookCard from "../../components/CompactBookCard.astro";
  ```

  ```astro
  {sameVoiceBooks.length > 0 && voicesLabel && (
    <Section title={`Lu par ${voicesLabel}`}>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        {sameVoiceBooks.map((b) => <CompactBookCard book={b} />)}
      </div>
    </Section>
  )}
  ```

  Do the same for the “Les plus aimés” section.

- [ ] **Step 2: Use Section for main blocks**

  Wrap “Écouter / Télécharger” and “Description” sections with `Section.astro`.

- [ ] **Step 3: Run astro check + build**

- [ ] **Step 4: Commit**

  ```bash
  git add web/src/pages/livre-audio-gratuit-mp3/[slug].astro
  git commit -m "refactor(web): use design system components on book page"
  ```

---

### Task 6: Refactorer l’accueil et les listes avec les nouveaux composants

**Files:**
- Modify: `web/src/pages/index.astro`, `web/src/components/BookList.astro`

**Interfaces:**
- Consumes: `Section.astro`, `BookGrid.astro`.

- [ ] **Step 1: Rewrite index.astro using Section + BookGrid**

  Keep existing logic for nouveautes / choix / populaires.
  Replace each `<section class="mb-10">` with `<Section title=... action=...>` and wrap grids with `<BookGrid>`.

- [ ] **Step 2: Update BookList.astro**

  Use `Section` and `BookGrid`.

  ```astro
  <Section title={title}>
    <BookGrid>
      {pageBooks.map((book) => <BookCard book={book} />)}
    </BookGrid>
    {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={baseUrl} />}
  </Section>
  ```

- [ ] **Step 3: Run astro check + build**

- [ ] **Step 4: Commit**

  ```bash
  git add web/src/pages/index.astro web/src/components/BookList.astro
  git commit -m "refactor(web): use design system on home and book lists"
  ```

---

### Task 7: Renommer “Les plus aimés” → “Les plus écoutés”

**Files:**
- Modify: `web/src/pages/index.astro` (section title), `web/src/pages/livre-audio-gratuit-mp3/[slug].astro` (recommendation title), `web/src/pages/classement-de-nos-livres-audio-gratuits-les-plus-apprecies.astro` (page title + BookList title), `web/src/components/Sidebar.astro` (menu label)

- [ ] **Step 1: Replace all occurrences of “Les plus aimés” by “Les plus écoutés”**

- [ ] **Step 2: Rename page file (optional)**

  For consistency, rename `classement-de-nos-livres-audio-gratuits-les-plus-apprecies.astro` to `classement-de-nos-livres-audio-gratuits-les-plus-ecoutes.astro` and update `Sidebar.astro` link. This changes the URL, which may break external links. Decide based on project policy. For this plan, keep the old filename to avoid URL change and only update labels.

- [ ] **Step 3: Run astro check + build**

- [ ] **Step 4: Commit**

  ```bash
  git add web/src/pages/index.astro web/src/pages/livre-audio-gratuit-mp3/[slug].astro web/src/pages/classement-de-nos-livres-audio-gratuits-les-plus-apprecies.astro web/src/components/Sidebar.astro
  git commit -m "fix(web): rename 'Les plus aimés' to 'Les plus écoutés' to match sorting"
  ```

---

### Task 8: Nettoyer AudioProvider

**Files:**
- Modify: `web/src/components/Player/AudioProvider.tsx`

**Interfaces:**
- Produces: `AudioStore` public sans méthodes privées.

- [ ] **Step 1: Separate public and internal types**

  ```ts
  type InternalAudioStore = AudioStore & {
    _state: AudioState;
    _listeners: Set<>() => void>;
    _audioEl: HTMLAudioElement | null;
    _version: number;
    _emit: () => void;
    _ensureAudio: (url: string) => HTMLAudioElement;
  };
  ```

  Update `createStore` return type and `Window.__AUDIO_STORE__` to use `InternalAudioStore`.
  Keep `AudioStore` as the public type returned by `useAudio()`.

- [ ] **Step 2: Remove unused import**

  Change:
  ```ts
  import type { AudioActions, AudioBook, AudioState, AudioTrack } from "../../types/audio";
  ```
  to:
  ```ts
  import type { AudioActions, AudioBook, AudioState } from "../../types/audio";
  ```

- [ ] **Step 3: Add server-side safety comment**

  Add at the top of the file:
  ```ts
  // This module must only be used inside client React islands.
  // It relies on window.__AUDIO_STORE__ and HTMLAudioElement.
  ```

- [ ] **Step 4: Run astro check + build**

- [ ] **Step 5: Commit**

  ```bash
  git add web/src/components/Player/AudioProvider.tsx
  git commit -m "refactor(web): separate public and internal audio store types"
  ```

---

### Task 9: Pagination statique

**Files:**
- Create: `web/src/pages/nos-derniers-livres-audio-gratuits/[page].astro`, `web/src/pages/classement-de-nos-livres-audio-gratuits-les-plus-apprecies/[page].astro`, `web/src/pages/livre-audio-gratuit-mp3/genre/[slug]/[page].astro`
- Modify: `web/src/components/Pagination.astro`, `web/src/pages/nos-derniers-livres-audio-gratuits.astro`, `web/src/pages/classement-de-nos-livres-audio-gratuits-les-plus-apprecies.astro`, `web/src/pages/livre-audio-gratuit-mp3/genre/[slug].astro`

**Interfaces:**
- `Pagination.astro`: new props `currentPage`, `totalPages`, `baseUrl` (same) but generates `/baseUrl/page/N.html` links.

- [ ] **Step 1: Update Pagination.astro**

  ```astro
  ---
  import { pageUrl } from "../lib/urls";

  interface Props {
    currentPage: number;
    totalPages: number;
    baseUrl: string;
  }
  const { currentPage, totalPages, baseUrl } = Astro.props;
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const pageUrlPath = (n: number) => pageUrl(n === 1 ? baseUrl : `${baseUrl}/page/${n}`);
  ---
  <nav aria-label="Pagination" class="flex justify-center gap-2 mt-8">
    {hasPrev && <a href={pageUrlPath(currentPage - 1)} class="px-3 py-1 border rounded hover:bg-gray-100">← Précédent</a>}
    <span class="px-3 py-1">Page {currentPage} / {totalPages}</span>
    {hasNext && <a href={pageUrlPath(currentPage + 1)} class="px-3 py-1 border rounded hover:bg-gray-100">Suivant →</a>}
  </nav>
  ```

- [ ] **Step 2: Create static paginated routes**

  Each route uses `getStaticPaths` to generate all pages.

  Example for nouveautés:

  ```astro
  ---
  // web/src/pages/nos-derniers-livres-audio-gratuits/[page].astro
  import { getCollection } from "astro:content";
  import Base from "../../layouts/Base.astro";
  import BookList from "../../components/BookList.astro";

  export async function getStaticPaths() {
    const allBooks = await getCollection("books");
    const books = [...allBooks].sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
    const pageSize = 24;
    const totalPages = Math.max(1, Math.ceil(books.length / pageSize));
    return Array.from({ length: totalPages }, (_, i) => ({
      params: { page: String(i + 1) },
      props: { books, currentPage: i + 1, totalPages, pageSize },
    }));
  }

  const { books, currentPage, totalPages, pageSize } = Astro.props;
  ---

  <Base
    title={`Nos derniers livres audio gratuits - Page ${currentPage} | Litteratureaudio.com`}
    description="Découvrez les derniers livres audio gratuits ajoutés sur Litteratureaudio.com."
  >
    <BookList books={books} title="Nouveautés" currentPage={currentPage} pageSize={pageSize} baseUrl="/nos-derniers-livres-audio-gratuits" />
  </Base>
  ```

  Do similar for `classement-de-nos-livres-audio-gratuits-les-plus-apprecies/[page].astro` and `livre-audio-gratuit-mp3/genre/[slug]/[page].astro`.

- [ ] **Step 3: Update existing page files**

  Change `nos-derniers-livres-audio-gratuits.astro` and `classement-de-nos-livres-audio-gratuits-les-plus-apprecies.astro` to redirect to page 1:

  ```astro
  ---
  return Astro.redirect("/nos-derniers-livres-audio-gratuits/page/1.html");
  ---
  ```

  Update `genre/[slug].astro` similarly.

- [ ] **Step 4: Run astro check + build**

- [ ] **Step 5: Commit**

  ```bash
  git add web/src/components/Pagination.astro web/src/pages/nos-derniers-livres-audio-gratuits web/src/pages/classement-de-nos-livres-audio-gratuits-les-plus-apprecies web/src/pages/livre-audio-gratuit-mp3/genre
  git commit -m "feat(web): implement static pagination with page/N routes"
  ```

---

### Task 10: Supprimer les fichiers morts

**Files:**
- Delete: `web/src/lib/image-url.ts`, `web/src/components/Picture.astro`

- [ ] **Step 1: Delete files**

  ```bash
  git rm web/src/lib/image-url.ts web/src/components/Picture.astro
  ```

- [ ] **Step 2: Run astro check + build**

- [ ] **Step 3: Commit**

  ```bash
  git commit -m "chore(web): remove unused image-url and Picture components"
  ```

---

## Self-Review

1. **Spec coverage:**
   - URL helper → Task 1
   - `toAudioBook` → Task 2
   - Design system → Task 3
   - BookCard a11y → Task 4
   - Fiche livre refactor → Task 5
   - Home/list refactor → Task 6
   - “Les plus aimés” rename → Task 7
   - AudioProvider cleanup → Task 8
   - Pagination statique → Task 9
   - Fichiers morts → Task 10

2. **Placeholder scan:** Aucun TBD/TODO. Tous les chemins et signatures sont exacts.

3. **Type consistency:** `pageUrl` renvoie toujours une string. `toAudioBook` renvoie `AudioBook`. `Section`, `BookGrid`, `CompactBookCard` utilisent `CollectionEntry<"books">`.
