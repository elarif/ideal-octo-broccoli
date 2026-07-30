# Layout fidèle, sidebar et menu mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructurer le clone pour reproduire fidèlement le layout du site original : sidebar gauche fixe sur desktop, header avec logo et recherche, menu mobile off-canvas, cartes avec bouton Play accessible au tactile.

**Architecture:** Layout flexbox avec sidebar gauche fixe (256px) + header sticky + contenu + footer. Le menu mobile utilise du vanilla JS inline pour toggle off-canvas. Les cartes utilisent `aspect-[3/4]` pour un ratio uniforme et un bouton Play toujours visible. Le lecteur audio (AudioProvider/GlobalPlayer/TrackList) reste inchangé.

**Tech Stack:** Astro 4, Tailwind CSS 3, React 18 (islands), vanilla JS (toggle mobile).

## Global Constraints

- **Couleur primaire** : `#466cde`.
- **Langue** : français (fr-FR).
- **Sidebar desktop** : `w-64 sticky top-0 h-screen overflow-y-auto`, visible ≥768px.
- **Sidebar mobile** : `fixed translate-x-(-100%)` par défaut, `translate-x-0` quand ouverte.
- **Bouton Play** : toujours visible, `opacity-60` par défaut, `opacity-100` au hover/tap.
- **Ratio couverture** : `aspect-[3/4] object-cover w-full`.
- **Liens "Bientôt"** : `text-gray-400` + badge discret, non cliquables.
- **AudioProvider** : `client:load` dans Base.astro (fix déjà appliqué en `f2af1b1`).
- **Hors scope** : dark mode, recherche avancée avec filtres, commentaires, forums, favoris fonctionnels, images responsive srcset.

---

### Task 1: Base.astro — layout flexbox avec sidebar + header + contenu + footer

**Files:**
- Modify: `web/src/layouts/Base.astro`

**Interfaces:**
- Consumes: `Header.astro`, `Sidebar.astro`, `Footer.astro`, `AudioProvider`, `GlobalPlayer`.
- Produces: layout global avec structure `<div class="flex">` sidebar + contenu, vanilla JS pour toggle mobile.

- [ ] **Step 1: Restructurer Base.astro**

Remplacer le `<body>` de `web/src/layouts/Base.astro` par :

```astro
<body class="min-h-screen">
  <AudioProvider client:load>
    <div class="flex">
      <Sidebar />
      <div class="flex-1 min-w-0 flex flex-col min-h-screen">
        <Header />
        <main class="flex-1 max-w-6xl mx-auto w-full p-4 pb-24">
          <slot />
        </main>
        <Footer />
      </div>
    </div>
    <div id="sidebar-overlay" class="fixed inset-0 bg-black/50 z-40 md:hidden hidden"></div>
    <GlobalPlayer client:load />
  </AudioProvider>

  <script is:inline>
    function toggleSidebar() {
      const sidebar = document.getElementById("sidebar");
      const overlay = document.getElementById("sidebar-overlay");
      if (!sidebar || !overlay) return;
      const isOpen = sidebar.classList.contains("translate-x-0");
      if (isOpen) {
        sidebar.classList.remove("translate-x-0");
        sidebar.classList.add("-translate-x-full");
        overlay.classList.add("hidden");
        document.body.style.overflow = "";
      } else {
        sidebar.classList.remove("-translate-x-full");
        sidebar.classList.add("translate-x-0");
        overlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";
      }
    }
    document.addEventListener("DOMContentLoaded", () => {
      const overlay = document.getElementById("sidebar-overlay");
      const toggle = document.getElementById("menu-toggle");
      const closeBtn = document.getElementById("sidebar-close");
      overlay?.addEventListener("click", toggleSidebar);
      toggle?.addEventListener("click", toggleSidebar);
      closeBtn?.addEventListener("click", toggleSidebar);
    });
  </script>
</body>
```

- [ ] **Step 2: Vérifier le build**

```bash
cd web
pnpm exec astro check
```

Expected : 0 erreur (des warnings sur Sidebar/Header manquants sont normaux si on les modifie après).

- [ ] **Step 3: Commit**

```bash
git add web/src/layouts/Base.astro
git commit -m "feat(web): restructure Base.astro with sidebar+content flexbox layout"
```

---

### Task 2: Sidebar.astro — 3 groupes, classes mobile off-canvas, badge "Bientôt"

**Files:**
- Modify: `web/src/components/Sidebar.astro`

**Interfaces:**
- Consumes: `getCollection("books")` pour le compteur.
- Produces: `<aside id="sidebar">` avec classes off-canvas mobile, bouton `✕`, liens "Bientôt".

- [ ] **Step 1: Réécrire Sidebar.astro**

Remplacer tout le contenu de `web/src/components/Sidebar.astro` par :

```astro
---
import { getCollection } from "astro:content";

const books = await getCollection("books");
const totalBooks = books.length;

const menuGroups = [
  {
    title: "Livres audio",
    items: [
      { href: "/", label: `Accueil (${totalBooks})` },
      { href: "/classement-de-nos-livres-audio-gratuits-les-plus-apprecies", label: "Les plus aimés" },
      { href: "/nos-derniers-livres-audio-gratuits", label: "Nouveautés" },
      { href: "/notre-bibliotheque-de-livres-audio-gratuits", label: "Par genre" },
      { href: "/classement-de-nos-livres-audio-gratuits-par-auteur", label: "Par auteur" },
      { href: "/classement-de-nos-livres-audio-gratuits-par-donneur-ou-donneuse-de-voix", label: "Par donneur de voix" },
      { href: "/recherche", label: "Recherche avancée" },
    ],
  },
  {
    title: "Communauté",
    items: [
      { href: "", label: "Derniers commentaires", soon: true },
      { href: "", label: "Livre d'or", soon: true },
      { href: "", label: "Forums", soon: true },
      { href: "/notre-association", label: "Notre association" },
      { href: "/nous-aider", label: "Nous aider" },
    ],
  },
  {
    title: "Espace Perso",
    items: [
      { href: "", label: "Profil", soon: true },
      { href: "", label: "Favoris", soon: true },
    ],
  },
];
---

<aside
  id="sidebar"
  class="fixed top-0 left-0 h-full w-64 z-50 bg-gray-50 border-r p-4 overflow-y-auto transform -translate-x-full transition-transform duration-300 md:static md:translate-x-0 md:sticky md:top-0 md:h-screen"
>
  <div class="flex items-center justify-between mb-6">
    <a href="/" class="text-xl font-semibold text-primary">Litteratureaudio.com</a>
    <button
      id="sidebar-close"
      class="md:hidden text-gray-500 hover:text-gray-800 p-1"
      aria-label="Fermer le menu"
    >
      ✕
    </button>
  </div>

  {menuGroups.map((group) => (
    <nav class="mb-6" aria-label={group.title}>
      <h2 class="text-xs font-bold uppercase text-gray-500 mb-2">{group.title}</h2>
      <ul class="space-y-1">
        {group.items.map((item) => (
          <li>
            {item.soon ? (
              <span class="flex items-center justify-between px-2 py-1 text-gray-400">
                <span>{item.label}</span>
                <span class="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Bientôt</span>
              </span>
            ) : (
              <a
                href={item.href}
                class="block px-2 py-1 rounded hover:bg-gray-200 text-gray-800"
              >
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  ))}
</aside>
```

- [ ] **Step 2: Vérifier le build**

```bash
cd web
pnpm exec astro check
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Sidebar.astro
git commit -m "feat(web): sidebar with 3 groups, mobile off-canvas, Bientôt badges"
```

---

### Task 3: Header.astro — hamburger mobile, logo, recherche desktop

**Files:**
- Modify: `web/src/components/Header.astro`

**Interfaces:**
- Produces: `<header>` avec `#menu-toggle` (hamburger `md:hidden`), logo, recherche `hidden sm:flex`, icônes.

- [ ] **Step 1: Réécrire Header.astro**

Remplacer tout le contenu de `web/src/components/Header.astro` par :

```astro
---
---
<header class="border-b p-4 bg-white sticky top-0 z-30">
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <button
        id="menu-toggle"
        class="md:hidden text-gray-600 hover:text-primary p-1"
        aria-label="Ouvrir le menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
      <a href="/" class="text-xl font-semibold text-primary" rel="home">Litteratureaudio.com</a>
    </div>

    <form action="/recherche" method="GET" class="hidden sm:flex flex-1 max-w-md gap-2">
      <input
        type="search"
        name="q"
        placeholder="Recherche un livre audio gratuit"
        aria-label="Rechercher"
        class="flex-1 border rounded px-3 py-1 text-sm"
      />
      <button type="submit" class="bg-primary text-white px-3 py-1 rounded text-sm">OK</button>
    </form>

    <nav aria-label="Navigation principale" class="flex items-center gap-3 text-sm">
      <a href="#" class="text-gray-600 hover:text-primary" aria-label="Favoris">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
      </a>
      <a href="#" class="text-gray-600 hover:text-primary" aria-label="Se connecter">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      </a>
    </nav>
  </div>
</header>
```

- [ ] **Step 2: Vérifier le build**

```bash
cd web
pnpm exec astro check
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Header.astro
git commit -m "feat(web): header with hamburger toggle, logo, search, icons"
```

---

### Task 4: BookCard.astro — ratio 3:4, bouton Play toujours visible, badges repositionnés

**Files:**
- Modify: `web/src/components/BookCard.astro`

**Interfaces:**
- Consumes: `PlayButton`, `AudioBook`, `formatDuration`, `formatViews`, `Picture`.
- Produces: carte avec `aspect-[3/4]`, bouton Play `opacity-60` toujours visible, `stopPropagation`.

- [ ] **Step 1: Réécrire BookCard.astro**

Remplacer tout le contenu de `web/src/components/BookCard.astro` par :

```astro
---
import type { CollectionEntry } from "astro:content";
import { formatDuration } from "../lib/format-duration";
import { formatViews } from "../lib/format-views";
import { PlayButton } from "./Player/PlayButton";
import type { AudioBook } from "../types/audio";

interface Props {
  book: CollectionEntry<"books">;
}

const { book } = Astro.props;
const d = book.data;
const authorsLabel = d.authors.map((a) => a.name).join(", ");

const audioBook: AudioBook = {
  slug: d.slug,
  title: d.title,
  authorsLabel,
  coverUrl: d.cover?.url,
  tracks: d.tracks.map((t) => ({
    id: t.id,
    slug: t.slug,
    title: t.title,
    url: t.url,
    duration: t.duration,
  })),
};
---

<article class="border rounded overflow-hidden hover:shadow transition group relative">
  <a href={`/livre-audio-gratuit-mp3/${d.slug}.html`} class="block">
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
  <div class="absolute top-2 left-2">
    <PlayButton client:visible book={audioBook} className="w-10 h-10 shadow opacity-60 hover:opacity-100" />
  </div>
</article>
```

- [ ] **Step 2: Vérifier le build**

```bash
cd web
pnpm exec astro check
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/BookCard.astro
git commit -m "feat(web): BookCard with 3:4 ratio, always-visible Play button, badges"
```

---

### Task 5: PlayButton.tsx — stopPropagation sur le clic

**Files:**
- Modify: `web/src/components/Player/PlayButton.tsx`

**Interfaces:**
- Consumes: `useAudio()`.
- Produces: bouton qui ne déclenche pas le lien parent.

- [ ] **Step 1: Ajouter stopPropagation**

Dans `web/src/components/Player/PlayButton.tsx`, modifier `handleClick` :

```tsx
import { Play, Pause } from "lucide-react";
import { useAudio } from "./AudioProvider";
import type { AudioBook } from "../../types/audio";

interface Props {
  book: AudioBook;
  trackIndex?: number;
  className?: string;
  label?: string;
}

export function PlayButton({ book, trackIndex = 0, className = "", label }: Props) {
  const { currentBook, currentTrackIndex, isPlaying, playBook, togglePlay } = useAudio();
  const isThis = currentBook?.slug === book.slug && (trackIndex === undefined || currentBook.tracks[currentTrackIndex]?.id === book.tracks[trackIndex]?.id);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isThis) togglePlay();
    else playBook(book, trackIndex);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition ${className}`}
      aria-label={isThis && isPlaying ? "Pause" : "Lire"}
    >
      {isThis && isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
      {label && <span className="ml-2">{label}</span>}
    </button>
  );
}
```

- [ ] **Step 2: Vérifier le build**

```bash
cd web
pnpm exec astro check
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Player/PlayButton.tsx
git commit -m "fix(web): PlayButton stopPropagation to prevent card link navigation"
```

---

### Task 6: Fiche livre — layout header + TrackList + liens cliquables

**Files:**
- Modify: `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`

**Interfaces:**
- Consumes: `Base`, `TrackList`, `Picture`, `formatDuration`, `formatViews`, `AudioBook`.
- Produces: fiche avec header flex, métadonnées cliquables, liste de pistes, description.

- [ ] **Step 1: Réécrire la fiche livre**

Remplacer tout le contenu de `web/src/pages/livre-audio-gratuit-mp3/[slug].astro` par :

```astro
---
import { getCollection } from "astro:content";
import Base from "../../layouts/Base.astro";
import { TrackList } from "../../components/Player/TrackList";
import { formatDuration } from "../../lib/format-duration";
import { formatViews } from "../../lib/format-views";
import type { AudioBook } from "../../types/audio";

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
const periodsLabel = d.periods.map((p) => p.name).join(", ");
const regionsLabel = d.regions.map((r) => r.name).join(", ");
const licencesLabel = d.licences.map((l) => l.name).join(", ");

const audioBook: AudioBook = {
  slug: d.slug,
  title: d.title,
  authorsLabel,
  coverUrl: d.cover?.url,
  tracks: d.tracks.map((t) => ({
    id: t.id,
    slug: t.slug,
    title: t.title,
    url: t.url,
    duration: t.duration,
  })),
};
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
        <div class="md:w-1/3 max-w-xs">
          <img
            src={d.cover.url}
            width={d.cover.width}
            height={d.cover.height}
            alt={d.cover.alt || d.title}
            loading="eager"
            fetchpriority="high"
            decoding="async"
            class="w-full h-auto rounded shadow-lg object-cover aspect-[3/4]"
          />
        </div>
      )}
      <div class="flex-1">
        <h1 class="text-3xl font-bold mb-2">{d.title}</h1>
        {authorsLabel && (
          <p class="mb-1">
            De {d.authors.map((a, i) => (
              <Fragment><a href={`/livre-audio-gratuit-mp3/auteur/${a.slug}.html`} class="text-primary hover:underline">{a.name}</a>{i < d.authors.length - 1 ? ", " : ""}</Fragment>
            ))}
          </p>
        )}
        {voicesLabel && (
          <p class="mb-1">
            Lu par {d.voices.map((v, i) => (
              <Fragment><a href={`/livre-audio-gratuit-mp3/voix/${v.slug}.html`} class="text-primary hover:underline">{v.name}</a>{i < d.voices.length - 1 ? ", " : ""}</Fragment>
            ))}
          </p>
        )}
        <p class="mb-1">Durée : {formatDuration(d.durationTotal)}</p>
        {genresLabel && (
          <p class="mb-1">
            Genre : {d.genres.map((g, i) => (
              <Fragment><a href={`/livre-audio-gratuit-mp3/genre/${g.slug}.html`} class="text-primary hover:underline">{g.name}</a>{i < d.genres.length - 1 ? ", " : ""}</Fragment>
            ))}
          </p>
        )}
        {periodsLabel && <p class="mb-1">Période : {periodsLabel}</p>}
        {regionsLabel && <p class="mb-1">Région : {regionsLabel}</p>}
        {licencesLabel && <p class="mb-1">Licence : {licencesLabel}</p>}
        {d.views > 0 && <p class="mb-1 text-gray-600">{formatViews(d.views)} écoutes</p>}
        {d.commentCount > 0 && <p class="mb-1 text-gray-600">{d.commentCount} commentaire{d.commentCount > 1 ? "s" : ""}</p>}
      </div>
    </header>

    {d.tracks.length > 0 && (
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">Écouter / Télécharger</h2>
        <TrackList client:load book={audioBook} />
      </section>
    )}

    {d.content && (
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">Description</h2>
        <div class="prose max-w-none" set:html={d.content} />
      </section>
    )}
  </article>
</Base>
```

- [ ] **Step 2: Vérifier le build**

```bash
cd web
pnpm exec astro check
```

Expected : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/livre-audio-gratuit-mp3/\[slug\].astro
git commit -m "feat(web): book page with flex header, clickable metadata, track list"
```

---

### Task 7: global.css — primary color et transitions

**Files:**
- Modify: `web/src/styles/global.css`

**Interfaces:**
- Produces: `--color-primary: #466cde`, classes utilitaires `text-primary`, `bg-primary`.

- [ ] **Step 1: Vérifier la couleur primaire**

Lire `web/src/styles/global.css`. Si la couleur primaire `#466cde` n'est pas définie ou si les classes `text-primary` / `bg-primary` n'existent pas, ajouter dans `@layer base` :

```css
@layer base {
  :root {
    --color-primary: #466cde;
  }
  .text-primary { color: #466cde; }
  .bg-primary { background-color: #466cde; }
  .hover\:bg-primary\/90:hover { background-color: rgba(70, 108, 222, 0.9); }
  .border-primary { border-color: #466cde; }
}
```

Si Tailwind est configuré via `tailwind.config` avec `theme.extend.colors.primary`, ajouter plutôt :

```js
colors: { primary: "#466cde" }
```

Vérifier `web/tailwind.config.mjs` ou `tailwind.config.ts` pour la configuration existante et s'assurer que `primary` est défini.

- [ ] **Step 2: Vérifier le build**

```bash
cd web
pnpm exec astro check
pnpm exec astro build
```

Expected : 0 erreur, build réussit.

- [ ] **Step 3: Commit**

```bash
git add web/src/styles/global.css web/tailwind.config.mjs
git commit -m "feat(web): ensure primary color #466cde is configured"
```

---

### Task 8: Build complet et validation

**Files:**
- Aucun — seulement exécution.

- [ ] **Step 1: Build complet**

```bash
cd web
pnpm exec astro check
pnpm exec astro build
```

Expected : 0 erreur, build réussit, `dist/index.html` généré.

- [ ] **Step 2: Tests visuels**

1. Ouvrir `dist/index.html` : vérifier sidebar gauche + header + grille de cartes.
2. Vérifier que le bouton Play est visible sur les cartes (opacity-60).
3. Redimensionner à <768px : vérifier que le hamburger apparaît et ouvre la sidebar.
4. Naviguer vers une fiche livre : vérifier le header flex, la liste de pistes, les liens cliquables.
5. Cliquer Play sur une carte : vérifier que le player global apparaît et la lecture démarre.

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "chore: validate layout-fidele build"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- Layout global (sidebar + header + contenu + footer) ✓ (Task 1)
- Sidebar 3 groupes avec "Bientôt" ✓ (Task 2)
- Header avec hamburger, logo, recherche ✓ (Task 3)
- Cartes ratio 3:4, bouton Play visible ✓ (Task 4)
- PlayButton stopPropagation ✓ (Task 5)
- Fiche livre layout flex + TrackList + liens cliquables ✓ (Task 6)
- Couleur primaire #466cde ✓ (Task 7)
- Build et validation ✓ (Task 8)

**Placeholder scan:** aucun TBD/TODO.

**Type consistency:** `AudioBook` cohérent entre `types/audio.ts`, `BookCard.astro`, `[slug].astro`, `PlayButton.tsx`. `Sidebar` consomme `getCollection("books")`. `Header` produit `#menu-toggle`. `Base.astro` consomme `#menu-toggle`, `#sidebar-close`, `#sidebar-overlay`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-30-layout-fidele-sidebar-menu-mobile-implementation.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — I execute tasks in this session using `executing-plans`.

**Which approach?**