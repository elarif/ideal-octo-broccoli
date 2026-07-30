# Litteratureaudio.com — Clone fidèle V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le MVP V0 Astro en un clone statique fidèle du site Litteratureaudio.com, avec lecteur audio, look & feel original, navigation par taxonomies et SEO complet.

**Architecture:** Astro reste en `output: "static"` et déployé sur Cloudflare Pages. Les données WordPress sont récupérées au build dans des content collections Astro (books + 7 taxonomies). L'interactivité (player audio, recherche) est assurée par des Astro Islands React. Le player global est monté dans le layout pour survivre aux navigations.

**Tech Stack:** Astro 4, React 18, Tailwind CSS 3, Zod, lucide-react.

## Global Constraints

- **Langue** : français (fr-FR).
- **Node** ≥ 20.11, **pnpm** ≥ 9.
- **Coût** : uniquement des services gratuits pour V1 (Cloudflare Pages).
- **Déploiement** : build statique, pas de backend.
- **Couleur primaire** : `#466cde`.
- **URLs fiches** : `/livre-audio-gratuit-mp3/<slug>.html`.
- **URLs taxonomies** : `/livre-audio-gratuit-mp3/<taxo>/<slug>.html`.
- **Hors scope V1** : auth, favoris, commentaires, forums, upload, newsletter, dark mode, analytics, oEmbed, calendrier.

---

## Task 1: Préparer React dans Astro

**Files:**
- Modify: `web/astro.config.ts`
- Modify: `web/package.json`
- Modify: `web/tsconfig.json`
- Create: `web/src/env.d.ts` (ou le mettre à jour)

**Interfaces:**
- Produces: `astro.config.ts` intègre `@astrojs/react`.
- Produces: `pnpm install` fonctionne et `astro check` passe.

- [ ] **Step 1: Ajouter les dépendances React**

Dans `web/package.json`, ajouter :

```json
{
  "dependencies": {
    "@astrojs/react": "^3.6.0",
    "lucide-react": "^0.400.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  }
}
```

Puis exécuter :

```bash
pnpm install
```

- [ ] **Step 2: Intégrer React dans Astro**

Modifier `web/astro.config.ts` :

```typescript
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";

export default defineConfig({
  site: process.env.SITE_URL || "https://litteratureaudio.pages.dev",
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [tailwind({ applyBaseStyles: false }), sitemap(), react()],
});
```

- [ ] **Step 3: Vérifier TypeScript React**

S'assurer que `web/tsconfig.json` contient :

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@lib/*": ["src/lib/*"],
      "@components/*": ["src/components/*"]
    },
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": ["src/**/*", "scripts/**/*", "*.config.ts"]
}
```

- [ ] **Step 4: Vérifier le build**

```bash
cd web
pnpm exec astro check
```

Expected : 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/astro.config.ts web/tsconfig.json pnpm-lock.yaml
git commit -m "chore(web): add React islands support for V1"
```

---

## Task 2: Étendre le data layer — récupérer toutes les taxonomies

**Files:**
- Modify: `web/src/lib/wp-client.ts`
- Modify: `web/src/lib/env.ts` (optionnel)
- Modify: `web/src/content/config.ts`
- Modify: `web/scripts/fetch-content.ts`
- Create: `web/src/lib/fetch-taxonomies.ts`

**Interfaces:**
- Consumes: `wpClient.paginatePosts()` existant.
- Produces: `wpClient.paginateTerms(taxonomy: string)` → `AsyncGenerator<WpTerm>`.
- Produces: `fetchTaxonomies()` → écrit `src/content/{authors,voices,genres,periods,regions,licences,tags}/*.json`.
- Produces: `books` schema enrichi avec `periods`, `regions`, `licences`, `tags`.

- [ ] **Step 1: Ajouter le client de taxonomies**

Modifier `web/src/lib/wp-client.ts` pour ajouter :

```typescript
export interface WpTerm {
  id: number;
  slug: string;
  name: string;
  description?: string;
  count?: number;
}

class WpClient {
  // ... existing methods ...

  async *paginateTerms(taxonomy: string): AsyncGenerator<WpTerm> {
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const { data, headers } = await this.req(`/wp-json/wp/v2/${taxonomy}`, {
        perPage: 100,
        page,
        hide_empty: true,
        _fields: "id,slug,name,description,count",
      });
      const terms = data as WpTerm[];
      totalPages = Number(headers.get("x-wp-totalpages") || 1);
      for (const t of terms) yield t;
      page++;
    }
  }
}
```

- [ ] **Step 2: Créer le helper fetchTaxonomies**

Créer `web/src/lib/fetch-taxonomies.ts` :

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wpClient, type WpTerm } from "./wp-client";

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
```

- [ ] **Step 3: Étendre le schema books**

Modifier `web/src/content/config.ts` :

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
    periods: z.array(TermRef),
    regions: z.array(TermRef),
    licences: z.array(TermRef),
    tags: z.array(TermRef),
    tracks: z.array(Track),
    views: z.number().int().nonnegative().default(0),
    commentCount: z.number().int().nonnegative().default(0),
    publishedAt: z.coerce.date(),
    modifiedAt: z.coerce.date(),
    legacyUrl: z.string().url(),
  }),
});

const termCollection = defineCollection({
  type: "data",
  schema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
    name: z.string(),
    description: z.string().default(""),
    count: z.number().int().nonnegative().default(0),
  }),
});

export const collections = {
  books,
  authors: termCollection,
  voices: termCollection,
  genres: termCollection,
  periods: termCollection,
  regions: termCollection,
  licences: termCollection,
  tags: termCollection,
};
```

- [ ] **Step 4: Étendre fetch-content.ts**

Modifier `web/scripts/fetch-content.ts` pour :
1. Appeler `fetchTaxonomies`.
2. Extraire `periods`, `regions`, `licences`, `tags` via `termMap`.
3. Ajouter `views` et `commentCount` (fallback 0).

Exemple de modifications dans `main()` :

```typescript
import { fetchTaxonomies } from "../src/lib/fetch-taxonomies";

const BOOKS_OUT = join(process.cwd(), "src/content/books");

async function main() {
  await fetchTaxonomies(join(process.cwd(), "src/content"));

  await mkdir(BOOKS_OUT, { recursive: true });
  console.log(`→ Fetch up to ${FETCH_LIMIT} books from WordPress…`);
  // ... existing post fetch loop ...
}
```

Et dans le mapping du livre :

```typescript
const book = {
  // ... existing fields ...
  periods: termMap(post, "periode"),
  regions: termMap(post, "region"),
  licences: termMap(post, "licence"),
  tags: termMap(post, "post_tag"),
  views: 0,
  commentCount: 0,
  // ...
};
```

- [ ] **Step 5: Smoke test avec limite**

```bash
cd web
FETCH_LIMIT=20 WP_API_BASE=https://www.litteratureaudio.com pnpm exec tsx scripts/fetch-content.ts
```

Expected :
- Des fichiers dans `src/content/{authors,voices,genres,periods,regions,licences,tags}/`.
- Des fichiers dans `src/content/books/` avec `periods`, `regions`, `licences`, `tags`.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/wp-client.ts web/src/lib/fetch-taxonomies.ts web/src/content/config.ts web/scripts/fetch-content.ts
git commit -m "feat(web): fetch all taxonomies and enrich book schema"
```

---

## Task 3: Créer le système de lecteur audio React

**Files:**
- Create: `web/src/components/Player/AudioProvider.tsx`
- Create: `web/src/components/Player/PlayButton.tsx`
- Create: `web/src/components/Player/GlobalPlayer.tsx`
- Create: `web/src/components/Player/TrackList.tsx`
- Create: `web/src/types/audio.ts`
- Modify: `web/src/layouts/Base.astro`

**Interfaces:**
- Consumes: `books` collection entries.
- Produces: `AudioProvider` wraps children with audio context.
- Produces: `GlobalPlayer` sticky player bar.
- Produces: `PlayButton(bookSlug, trackIndex?)` launches playback.
- Produces: `TrackList(book)` displays playable tracks.

- [ ] **Step 1: Définir les types audio**

Créer `web/src/types/audio.ts` :

```typescript
export interface AudioTrack {
  id: number;
  slug: string;
  title: string;
  url: string;
  duration: number;
}

export interface AudioBook {
  slug: string;
  title: string;
  authorsLabel: string;
  coverUrl?: string;
  tracks: AudioTrack[];
}

export interface AudioState {
  isPlaying: boolean;
  currentBook: AudioBook | null;
  currentTrackIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
}

export interface AudioActions {
  playBook: (book: AudioBook, trackIndex?: number) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  close: () => void;
}

export type AudioContextValue = AudioState & AudioActions;
```

- [ ] **Step 2: Implémenter AudioProvider**

Créer `web/src/components/Player/AudioProvider.tsx` :

```tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AudioBook, AudioContextValue, AudioTrack } from "../../types/audio";

const AudioContext = createContext<AudioContextValue | null>(null);

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be used inside AudioProvider");
  return ctx;
}

interface Props {
  children: ReactNode;
}

export function AudioProvider({ children }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBook, setCurrentBook] = useState<AudioBook | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  const currentTrack: AudioTrack | null = currentBook?.tracks[currentTrackIndex] ?? null;

  useEffect(() => {
    if (!currentTrack) return;
    const audio = new Audio(currentTrack.url);
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => actions.playNext();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    audio.play().catch(() => setIsPlaying(false));

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audioRef.current = null;
    };
  }, [currentTrack?.url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const actions = useMemo<AudioActions>(() => ({
    playBook: (book, trackIndex = 0) => {
      setCurrentBook(book);
      setCurrentTrackIndex(Math.max(0, Math.min(trackIndex, book.tracks.length - 1)));
    },
    togglePlay: () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    },
    playNext: () => {
      if (!currentBook) return;
      const next = currentTrackIndex + 1;
      if (next < currentBook.tracks.length) setCurrentTrackIndex(next);
      else setIsPlaying(false);
    },
    playPrevious: () => {
      if (!currentBook) return;
      const prev = Math.max(0, currentTrackIndex - 1);
      setCurrentTrackIndex(prev);
    },
    seek: (time) => {
      const audio = audioRef.current;
      if (audio) audio.currentTime = time;
    },
    setVolume: (v) => setVolumeState(Math.max(0, Math.min(1, v))),
    close: () => {
      audioRef.current?.pause();
      setCurrentBook(null);
      setCurrentTrackIndex(0);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
    },
  }), [currentBook, currentTrackIndex]);

  const value: AudioContextValue = {
    isPlaying,
    currentBook,
    currentTrackIndex,
    currentTime,
    duration,
    volume,
    ...actions,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}
```

- [ ] **Step 3: Implémenter PlayButton**

Créer `web/src/components/Player/PlayButton.tsx` :

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
  const { currentBook, isPlaying, playBook, togglePlay } = useAudio();
  const isThis = currentBook?.slug === book.slug && (trackIndex === undefined || currentBook.tracks[currentTrackIndex]?.id === book.tracks[trackIndex]?.id);

  const handleClick = () => {
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

Corriger : importer `currentTrackIndex` dans le destructuring.

```tsx
const { currentBook, currentTrackIndex, isPlaying, playBook, togglePlay } = useAudio();
```

- [ ] **Step 4: Implémenter GlobalPlayer**

Créer `web/src/components/Player/GlobalPlayer.tsx` :

```tsx
import { Pause, Play, SkipBack, SkipForward, Volume2, X } from "lucide-react";
import { useAudio } from "./AudioProvider";
import { formatDuration } from "../../lib/format-duration";

export function GlobalPlayer() {
  const { currentBook, currentTrackIndex, isPlaying, currentTime, duration, volume, togglePlay, playNext, playPrevious, seek, setVolume, close } = useAudio();

  if (!currentBook) return null;

  const track = currentBook.tracks[currentTrackIndex];
  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg p-3">
      <div className="max-w-6xl mx-auto flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {currentBook.coverUrl && (
            <img src={currentBook.coverUrl} alt="" className="w-12 h-12 object-cover rounded" />
          )}
          <div className="min-w-0">
            <p className="font-medium truncate">{track?.title || currentBook.title}</p>
            <p className="text-sm text-gray-600 truncate">{currentBook.authorsLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={playPrevious} aria-label="Précédent"><SkipBack size={20} /></button>
          <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Lire"} className="p-2 rounded-full bg-primary text-white">
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          <button onClick={playNext} aria-label="Suivant"><SkipForward size={20} /></button>
        </div>

        <div className="hidden sm:flex items-center gap-2 flex-1">
          <span className="text-xs tabular-nums">{formatDuration(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="flex-1"
            aria-label="Progression"
          />
          <span className="text-xs tabular-nums">{formatDuration(duration)}</span>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Volume2 size={18} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-24"
            aria-label="Volume"
          />
        </div>

        <button onClick={close} aria-label="Fermer le lecteur"><X size={20} /></button>
      </div>
    </div>
  );
}
```

**Note:** `formatDuration` prend actuellement des secondes et retourne une string. Vérifie qu'elle retourne `mm:ss` pour le lecteur. Si elle retourne `"8 min"`, ajuster.

- [ ] **Step 5: Implémenter TrackList**

Créer `web/src/components/Player/TrackList.tsx` :

```tsx
import { Play, Pause, Download } from "lucide-react";
import { useAudio } from "./AudioProvider";
import { formatDuration } from "../../lib/format-duration";
import type { AudioBook } from "../../types/audio";

interface Props {
  book: AudioBook;
}

export function TrackList({ book }: Props) {
  const { currentBook, currentTrackIndex, isPlaying, playBook, togglePlay } = useAudio();
  const isThisBook = currentBook?.slug === book.slug;

  return (
    <ul className="space-y-2">
      {book.tracks.map((track, index) => {
        const isCurrent = isThisBook && currentTrackIndex === index;
        return (
          <li key={track.id} className="flex items-center gap-3 p-2 rounded border hover:bg-gray-50">
            <button
              onClick={() => (isCurrent ? togglePlay() : playBook(book, index))}
              className="p-2 rounded-full bg-primary text-white"
              aria-label={isCurrent && isPlaying ? "Pause" : `Lire ${track.title}`}
            >
              {isCurrent && isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <span className="flex-1">{track.title}</span>
            <span className="text-sm text-gray-600">{formatDuration(track.duration)}</span>
            <a href={track.url} download className="p-2 text-primary hover:text-primary/80" aria-label="Télécharger">
              <Download size={18} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 6: Intégrer dans Base.astro**

Modifier `web/src/layouts/Base.astro` :

```astro
---
import Header from "../components/Header.astro";
import Sidebar from "../components/Sidebar.astro";
import Footer from "../components/Footer.astro";
import { AudioProvider } from "../components/Player/AudioProvider";
import { GlobalPlayer } from "../components/Player/GlobalPlayer";
import "../styles/global.css";

interface Props {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
}

const { title, description, canonical, image } = Astro.props;
const siteUrl = Astro.site?.toString().replace(/\/$/, "") || "https://litteratureaudio.pages.dev";
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
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    {imageUrl && <meta name="twitter:image" content={imageUrl} />}
    <meta name="twitter:site" content="@littaudio" />
    <meta name="twitter:creator" content="@littaudio" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
  </head>
  <body class="min-h-screen flex flex-col">
    <AudioProvider client:load>
      <Header />
      <div class="flex flex-1">
        <Sidebar />
        <main class="flex-1 max-w-6xl mx-auto w-full p-4 pb-24">
          <slot />
        </main>
      </div>
      <Footer />
      <GlobalPlayer client:load />
    </AudioProvider>
  </body>
</html>
```

- [ ] **Step 7: Vérifier le build**

```bash
cd web
pnpm exec astro check
```

Expected : 0 erreur.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/Player web/src/types/audio.ts web/src/layouts/Base.astro
git commit -m "feat(web): add React audio player with global sticky bar"
```

---

## Task 4: Refonte UI — Header, Sidebar, Footer, BookCard, fiche livre

**Files:**
- Modify: `web/src/components/Header.astro`
- Create: `web/src/components/Sidebar.astro`
- Modify: `web/src/components/Footer.astro`
- Modify: `web/src/components/BookCard.astro`
- Modify: `web/src/components/Picture.astro`
- Modify: `web/src/pages/index.astro`
- Modify: `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`
- Modify: `web/src/styles/global.css`

**Interfaces:**
- Consumes: `collections` Astro et player `PlayButton`.
- Produces: UI fidèle avec navigation, cartes enrichies, fiche livre complète.

- [ ] **Step 1: Créer Sidebar.astro**

Créer `web/src/components/Sidebar.astro` :

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
      { href: "#", label: "Derniers commentaires", disabled: true },
      { href: "#", label: "Livre d'or", disabled: true },
      { href: "#", label: "Forums", disabled: true },
      { href: "/notre-association", label: "Notre association" },
      { href: "/nous-aider", label: "Nous aider" },
    ],
  },
  {
    title: "Espace Perso",
    items: [
      { href: "#", label: "Profil", disabled: true },
      { href: "#", label: "Favoris", disabled: true },
    ],
  },
];
---

<aside id="sidebar" class="hidden md:block w-64 border-r bg-gray-50 p-4 sticky top-0 h-screen overflow-y-auto">
  <a href="/" class="text-xl font-semibold text-primary block mb-6">Litteratureaudio.com</a>
  {menuGroups.map((group) => (
    <nav class="mb-6" aria-label={group.title}>
      <h2 class="text-xs font-bold uppercase text-gray-500 mb-2">{group.title}</h2>
      <ul class="space-y-1">
        {group.items.map((item) => (
          <li>
            {item.disabled ? (
              <span class="block px-2 py-1 text-gray-400 cursor-not-allowed">{item.label}</span>
            ) : (
              <a href={item.href} class="block px-2 py-1 rounded hover:bg-gray-200 text-gray-800">{item.label}</a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  ))}
</aside>
```

- [ ] **Step 2: Modifier Header.astro**

Remplacer `web/src/components/Header.astro` :

```astro
---
---
<header class="border-b p-4 bg-white sticky top-0 z-40">
  <div class="max-w-6xl mx-auto flex items-center justify-between gap-4">
    <a href="/" class="text-xl font-semibold text-primary" rel="home">Litteratureaudio.com</a>

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
      <a href="#" class="text-gray-600 hover:text-primary" aria-label="Favoris">♥</a>
      <a href="#" class="text-gray-600 hover:text-primary" aria-label="Se connecter">👤</a>
    </nav>
  </div>
</header>
```

- [ ] **Step 3: Modifier Footer.astro**

Remplacer `web/src/components/Footer.astro` :

```astro
---
const year = new Date().getFullYear();
---
<footer class="border-t p-8 mt-12 text-sm text-center text-gray-600">
  <p class="mb-2">© {year} Litteratureaudio.com — Association loi 1901.</p>
  <p><a href="/nous-aider" class="text-primary hover:underline">Nous aider</a> · <a href="/notre-association" class="text-primary hover:underline">Notre association</a></p>
</footer>
```

- [ ] **Step 4: Enrichir BookCard.astro**

Remplacer `web/src/components/BookCard.astro` :

```astro
---
import type { CollectionEntry } from "astro:content";
import { formatDuration } from "../lib/format-duration";
import { formatViews } from "../lib/format-views";
import Picture from "./Picture.astro";
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
    <figure class="relative">
      {d.cover && (
        <Picture
          src={d.cover.url}
          width={d.cover.width}
          height={d.cover.height}
          alt={d.cover.alt || d.title}
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
  <div class="absolute bottom-14 right-3 opacity-0 group-hover:opacity-100 transition">
    <PlayButton client:visible book={audioBook} className="w-10 h-10 shadow" />
  </div>
</article>
```

- [ ] **Step 5: Créer format-views.ts**

Créer `web/src/lib/format-views.ts` :

```typescript
export function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
```

- [ ] **Step 6: Modifier la fiche livre**

Remplacer `web/src/pages/livre-audio-gratuit-mp3/[slug].astro` :

```astro
---
import { getCollection } from "astro:content";
import Base from "../../layouts/Base.astro";
import Picture from "../../components/Picture.astro";
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
const tagsLabel = d.tags.map((t) => t.name).join(", ");

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
        <Picture
          src={d.cover.url}
          width={d.cover.width}
          height={d.cover.height}
          alt={d.cover.alt || d.title}
          loading="eager"
          fetchpriority="high"
          class="md:w-1/3"
        />
      )}
      <div class="flex-1">
        <h1 class="text-3xl font-bold mb-2">{d.title}</h1>
        {authorsLabel && (
          <p class="mb-1">
            De {d.authors.map((a, i) => (
              <><a href={`/livre-audio-gratuit-mp3/auteur/${a.slug}.html`} class="text-primary hover:underline">{a.name}</a>{i < d.authors.length - 1 ? ", " : ""}</>
            ))}
          </p>
        )}
        {voicesLabel && (
          <p class="mb-1">
            Lu par {d.voices.map((v, i) => (
              <><a href={`/livre-audio-gratuit-mp3/voix/${v.slug}.html`} class="text-primary hover:underline">{v.name}</a>{i < d.voices.length - 1 ? ", " : ""}</>
            ))}
          </p>
        )}
        <p class="mb-1">Durée : {formatDuration(d.durationTotal)}</p>
        {genresLabel && (
          <p class="mb-1">
            Genre : {d.genres.map((g, i) => (
              <><a href={`/livre-audio-gratuit-mp3/genre/${g.slug}.html`} class="text-primary hover:underline">{g.name}</a>{i < d.genres.length - 1 ? ", " : ""}</>
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

- [ ] **Step 7: Adapter format-duration pour le lecteur**

`formatDuration` retourne actuellement "8 min". Pour le lecteur, créer `web/src/lib/format-media-time.ts` :

```typescript
export function formatMediaTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
```

Et utiliser `formatMediaTime` dans `GlobalPlayer.tsx` et `TrackList.tsx` au lieu de `formatDuration`.

- [ ] **Step 8: Vérifier le build**

```bash
cd web
pnpm exec astro check
```

Expected : 0 erreur.

- [ ] **Step 9: Commit**

```bash
git add web/src/components web/src/pages/livre-audio-gratuit-mp3/\[slug\].astro web/src/lib/format-views.ts web/src/lib/format-media-time.ts web/src/styles/global.css
git commit -m "feat(web): faithful UI with header, sidebar, footer, cards and book page"
```

---

## Task 5: Pages de liste par taxonomie

**Files:**
- Create: `web/src/components/Pagination.astro`
- Create: `web/src/components/BookList.astro`
- Create: `web/src/pages/livre-audio-gratuit-mp3/auteur/[slug].astro`
- Create: `web/src/pages/livre-audio-gratuit-mp3/voix/[slug].astro`
- Create: `web/src/pages/livre-audio-gratuit-mp3/genre/[slug].astro`
- Create: `web/src/pages/livre-audio-gratuit-mp3/periode/[slug].astro`
- Create: `web/src/pages/livre-audio-gratuit-mp3/region/[slug].astro`
- Create: `web/src/pages/livre-audio-gratuit-mp3/licence/[slug].astro`
- Create: `web/src/pages/livre-audio-gratuit-mp3/tag/[slug].astro`

**Interfaces:**
- Consumes: `books` + taxonomie collection.
- Produces: pages statiques `/livre-audio-gratuit-mp3/<taxo>/<slug>.html` paginées.

- [ ] **Step 1: Créer Pagination.astro**

Créer `web/src/components/Pagination.astro` :

```astro
---
interface Props {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}

const { currentPage, totalPages, baseUrl } = Astro.props;
const hasPrev = currentPage > 1;
const hasNext = currentPage < totalPages;
---

<nav aria-label="Pagination" class="flex justify-center gap-2 mt-8">
  {hasPrev && (
    <a href={`${baseUrl}?page=${currentPage - 1}`} class="px-3 py-1 border rounded hover:bg-gray-100">← Précédent</a>
  )}
  <span class="px-3 py-1">Page {currentPage} / {totalPages}</span>
  {hasNext && (
    <a href={`${baseUrl}?page=${currentPage + 1}`} class="px-3 py-1 border rounded hover:bg-gray-100">Suivant →</a>
  )}
</nav>
```

- [ ] **Step 2: Créer BookList.astro**

Créer `web/src/components/BookList.astro` :

```astro
---
import type { CollectionEntry } from "astro:content";
import BookCard from "./BookCard.astro";
import Pagination from "./Pagination.astro";

interface Props {
  books: CollectionEntry<"books">[];
  title: string;
  currentPage: number;
  pageSize: number;
  baseUrl: string;
}

const { books, title, currentPage, pageSize, baseUrl } = Astro.props;
const totalPages = Math.max(1, Math.ceil(books.length / pageSize));
const start = (currentPage - 1) * pageSize;
const pageBooks = books.slice(start, start + pageSize);
---

<section>
  <h1 class="text-2xl font-bold mb-4">{title}</h1>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    {pageBooks.map((book) => <BookCard book={book} />)}
  </div>
  {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={baseUrl} />}
</section>
```

- [ ] **Step 3: Créer un helper de page taxonomie générique**

Créer `web/src/pages/livre-audio-gratuit-mp3/auteur/[slug].astro` en tant que modèle. Les autres taxonomies seront similaires.

```astro
---
import { getCollection } from "astro:content";
import Base from "../../../layouts/Base.astro";
import BookList from "../../../components/BookList.astro";

export async function getStaticPaths() {
  const authors = await getCollection("authors");
  return authors.map((author) => ({ params: { slug: author.slug } }));
}

const { slug } = Astro.params;
const author = await getCollection("authors").then((all) => all.find((a) => a.slug === slug));
if (!author) throw new Error(`Author not found: ${slug}`);

const allBooks = await getCollection("books");
const books = allBooks.filter((b) => b.data.authors.some((a) => a.slug === slug));
books.sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());

const pageParam = Astro.url.searchParams.get("page");
const currentPage = Math.max(1, Number(pageParam) || 1);
---

<Base
  title={`Livres audio de ${author.data.name} | Litteratureaudio.com`}
  description={`Écoutez et téléchargez gratuitement les livres audio de ${author.data.name}.`}
>
  <BookList
    books={books}
    title={`Livres audio de ${author.data.name}`}
    currentPage={currentPage}
    pageSize={24}
    baseUrl={`/livre-audio-gratuit-mp3/auteur/${slug}.html`}
  />
</Base>
```

- [ ] **Step 4: Générer les autres pages de taxonomie**

Dupliquer le modèle ci-dessus pour :
- `web/src/pages/livre-audio-gratuit-mp3/voix/[slug].astro` (filtre `b.data.voices`)
- `web/src/pages/livre-audio-gratuit-mp3/genre/[slug].astro` (filtre `b.data.genres`)
- `web/src/pages/livre-audio-gratuit-mp3/periode/[slug].astro` (filtre `b.data.periods`)
- `web/src/pages/livre-audio-gratuit-mp3/region/[slug].astro` (filtre `b.data.regions`)
- `web/src/pages/livre-audio-gratuit-mp3/licence/[slug].astro` (filtre `b.data.licences`)
- `web/src/pages/livre-audio-gratuit-mp3/tag/[slug].astro` (filtre `b.data.tags`)

Adapter le titre, la description et le champ filtre.

- [ ] **Step 5: Vérifier le build**

```bash
cd web
FETCH_LIMIT=50 WP_API_BASE=https://www.litteratureaudio.com pnpm exec tsx scripts/fetch-content.ts
pnpm exec astro check
```

Expected : 0 erreur (peut être long si les collections sont volumineuses).

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/livre-audio-gratuit-mp3 web/src/components/Pagination.astro web/src/components/BookList.astro
git commit -m "feat(web): add taxonomy listing pages with pagination"
```

---

## Task 6: Pages de classement et recherche

**Files:**
- Create: `web/src/pages/nos-derniers-livres-audio-gratuits.astro`
- Create: `web/src/pages/classement-de-nos-livres-audio-gratuits-les-plus-apprecies.astro`
- Create: `web/src/pages/notre-bibliotheque-de-livres-audio-gratuits.astro`
- Create: `web/src/pages/classement-de-nos-livres-audio-gratuits-par-auteur.astro`
- Create: `web/src/pages/classement-de-nos-livres-audio-gratuits-par-donneur-ou-donneuse-de-voix.astro`
- Create: `web/src/pages/notre-association.astro`
- Create: `web/src/pages/nous-aider.astro`
- Create: `web/src/pages/recherche.astro`
- Create: `web/src/components/SearchClient.tsx`
- Create: `web/src/components/AlphabeticalIndex.astro`

**Interfaces:**
- Consumes: `books` et collections de taxonomies.
- Produces: pages statiques de classement, recherche client, index alphabétique.

- [ ] **Step 1: Page nouveautés**

Créer `web/src/pages/nos-derniers-livres-audio-gratuits.astro` :

```astro
---
import { getCollection } from "astro:content";
import Base from "../layouts/Base.astro";
import BookList from "../components/BookList.astro";

const allBooks = await getCollection("books");
const books = [...allBooks].sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());

const pageParam = Astro.url.searchParams.get("page");
const currentPage = Math.max(1, Number(pageParam) || 1);
---

<Base
  title="Nos derniers livres audio gratuits | Litteratureaudio.com"
  description="Découvrez les derniers livres audio gratuits ajoutés sur Litteratureaudio.com."
>
  <BookList books={books} title="Nouveautés" currentPage={currentPage} pageSize={24} baseUrl="/nos-derniers-livres-audio-gratuits" />
</Base>
```

- [ ] **Step 2: Page les plus aimés**

Créer `web/src/pages/classement-de-nos-livres-audio-gratuits-les-plus-apprecies.astro` :

```astro
---
import { getCollection } from "astro:content";
import Base from "../layouts/Base.astro";
import BookList from "../components/BookList.astro";

const allBooks = await getCollection("books");
const books = [...allBooks].sort((a, b) => b.data.views - a.data.views);

const pageParam = Astro.url.searchParams.get("page");
const currentPage = Math.max(1, Number(pageParam) || 1);
---

<Base
  title="Les livres audio les plus appréciés | Litteratureaudio.com"
  description="Classement des livres audio gratuits les plus écoutés sur Litteratureaudio.com."
>
  <BookList books={books} title="Les plus aimés" currentPage={currentPage} pageSize={24} baseUrl="/classement-de-nos-livres-audio-gratuits-les-plus-apprecies" />
</Base>
```

- [ ] **Step 3: Page bibliothèque par genre**

Créer `web/src/pages/notre-bibliotheque-de-livres-audio-gratuits.astro` :

```astro
---
import { getCollection } from "astro:content";
import Base from "../layouts/Base.astro";

const genres = await getCollection("genres");
genres.sort((a, b) => b.data.count - a.data.count);
---

<Base
  title="Notre bibliothèque de livres audio gratuits | Litteratureaudio.com"
  description="Parcourez notre bibliothèque de livres audio gratuits par genre."
>
  <h1 class="text-2xl font-bold mb-6">Par genre</h1>
  <ul class="grid grid-cols-2 md:grid-cols-4 gap-4">
    {genres.map((genre) => (
      <li>
        <a href={`/livre-audio-gratuit-mp3/genre/${genre.slug}.html`} class="block p-4 border rounded hover:shadow transition">
          <span class="font-medium">{genre.data.name}</span>
          <span class="text-sm text-gray-600 block">{genre.data.count} livre{genre.data.count > 1 ? "s" : ""}</span>
        </a>
      </li>
    ))}
  </ul>
</Base>
```

- [ ] **Step 4: Index alphabétique auteurs / voix**

Créer `web/src/components/AlphabeticalIndex.astro` :

```astro
---
interface Item {
  slug: string;
  name: string;
  count: number;
}
interface Props {
  items: Item[];
  baseUrl: string;
  title: string;
}
const { items, baseUrl, title } = Astro.props;
const groups = new Map<string, Item[]>();
for (const item of items) {
  const letter = item.name.trim().charAt(0).toUpperCase();
  if (!groups.has(letter)) groups.set(letter, []);
  groups.get(letter)!.push(item);
}
const sortedLetters = [...groups.keys()].sort();
---

<section>
  <h1 class="text-2xl font-bold mb-4">{title}</h1>
  <div class="flex flex-wrap gap-2 mb-6">
    {sortedLetters.map((letter) => (
      <a href={`#letter-${letter}`} class="px-3 py-1 border rounded hover:bg-gray-100">{letter}</a>
    ))}
  </div>
  {sortedLetters.map((letter) => (
    <div id={`letter-${letter}`} class="mb-6">
      <h2 class="text-xl font-semibold mb-2">{letter}</h2>
      <ul class="grid grid-cols-2 md:grid-cols-3 gap-2">
        {groups.get(letter)!.map((item) => (
          <li>
            <a href={`${baseUrl}/${item.slug}.html`} class="text-primary hover:underline">{item.name}</a>
            <span class="text-sm text-gray-600"> ({item.count})</span>
          </li>
        ))}
      </ul>
    </div>
  ))}
</section>
```

Créer `web/src/pages/classement-de-nos-livres-audio-gratuits-par-auteur.astro` :

```astro
---
import { getCollection } from "astro:content";
import Base from "../layouts/Base.astro";
import AlphabeticalIndex from "../components/AlphabeticalIndex.astro";

const authors = await getCollection("authors");
const items = authors.map((a) => ({ slug: a.slug, name: a.data.name, count: a.data.count }));
---

<Base title="Classement par auteur | Litteratureaudio.com" description="Parcourez les livres audio gratuits par auteur.">
  <AlphabeticalIndex items={items} baseUrl="/livre-audio-gratuit-mp3/auteur" title="Par auteur" />
</Base>
```

Dupliquer pour les voix.

- [ ] **Step 5: Pages statiques association / nous aider**

Créer `web/src/pages/notre-association.astro` et `web/src/pages/nous-aider.astro` avec du contenu textuel simple (placeholder rédigé).

Exemple `notre-association.astro` :

```astro
---
import Base from "../layouts/Base.astro";
---

<Base title="Notre association | Litteratureaudio.com" description="Présentation de l'association Litteratureaudio.com.">
  <article class="prose max-w-none">
    <h1>Notre association</h1>
    <p>Litteratureaudio.com est une association loi 1901 dont l'objectif est de mettre gratuitement à disposition des livres audio du domaine public et sous licence libre.</p>
    <p>Ce site est entièrement géré par des bénévoles passionnés par la littérature et l'audio.</p>
  </article>
</Base>
```

- [ ] **Step 6: Recherche client**

Créer `web/src/components/SearchClient.tsx` :

```tsx
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

interface SearchDoc {
  slug: string;
  title: string;
  authors: string[];
  voices: string[];
  genres: string[];
}

interface Props {
  docs: SearchDoc[];
}

function normalize(str: string) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function SearchClient({ docs }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(id);
  }, [query]);

  const results = useMemo(() => {
    if (!debounced.trim()) return [];
    const terms = normalize(debounced).split(/\s+/).filter(Boolean);
    return docs.filter((doc) => {
      const haystack = normalize([doc.title, ...doc.authors, ...doc.voices, ...doc.genres].join(" "));
      return terms.every((t) => haystack.includes(t));
    }).slice(0, 24);
  }, [debounced, docs]);

  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Recherche un livre audio gratuit"
            className="w-full border rounded pl-10 pr-3 py-2"
            aria-label="Rechercher"
          />
        </div>
      </form>

      {query && !results.length && <p className="text-gray-600">Aucun résultat pour « {query} ».</p>}

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((r) => (
          <li key={r.slug}>
            <a href={`/livre-audio-gratuit-mp3/${r.slug}.html`} className="block border rounded p-3 hover:shadow transition">
              <p className="font-medium">{r.title}</p>
              <p className="text-sm text-gray-600">{r.authors.join(", ")}</p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Créer `web/src/pages/recherche.astro` :

```astro
---
import { getCollection } from "astro:content";
import Base from "../layouts/Base.astro";
import { SearchClient } from "../components/SearchClient";

const books = await getCollection("books");
const docs = books.map((b) => ({
  slug: b.data.slug,
  title: b.data.title,
  authors: b.data.authors.map((a) => a.name),
  voices: b.data.voices.map((v) => v.name),
  genres: b.data.genres.map((g) => g.name),
}));
---

<Base title="Recherche | Litteratureaudio.com" description="Recherchez parmi plus de 9000 livres audio gratuits.">
  <h1 class="text-2xl font-bold mb-4">Recherche avancée</h1>
  <SearchClient client:load docs={docs} />
</Base>
```

- [ ] **Step 7: Vérifier le build**

```bash
cd web
pnpm exec astro check
```

- [ ] **Step 8: Commit**

```bash
git add web/src/pages web/src/components/SearchClient.tsx web/src/components/AlphabeticalIndex.astro
git commit -m "feat(web): add ranking pages, search and static info pages"
```

---

## Task 7: SEO, flux RSS, favicons et JSON-LD

**Files:**
- Modify: `web/src/layouts/Base.astro`
- Modify: `web/src/pages/robots.txt.ts`
- Create: `web/src/pages/feed.xml.ts`
- Create: `web/src/components/JsonLd.astro`
- Modify: `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`
- Modify: `web/src/pages/index.astro`
- Modify: `web/astro.config.ts`
- Create: `web/public/favicon-32x32.png`
- Create: `web/public/favicon-180x180.png`
- Create: `web/public/favicon-192x192.png`

**Interfaces:**
- Produces: balises Twitter Cards, Open Graph complètes, canonical, shortlink.
- Produces: `/feed.xml` RSS 2.0 avec enclosures MP3.
- Produces: `/robots.txt` mis à jour.
- Produces: favicons multi-tailles.
- Produces: JSON-LD sur les fiches livre.

- [ ] **Step 1: Compléter Base.astro**

S'assurer que `Base.astro` contient toutes les balises SEO. Déjà couvert dans Task 3 ; ajouter si manquant :

```astro
<link rel="shortcut icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180x180.png" />
<meta name="msapplication-TileImage" content="/favicon-270x270.png" />
```

- [ ] **Step 2: Créer / modifier robots.txt.ts**

Modifier `web/src/pages/robots.txt.ts` :

```typescript
import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
  const site = import.meta.env.SITE || "https://litteratureaudio.pages.dev";
  const body = `User-agent: *
Allow: /
Sitemap: ${site}/sitemap-index.xml
`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
};
```

- [ ] **Step 3: Créer feed.xml.ts**

Créer `web/src/pages/feed.xml.ts` :

```typescript
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { formatDuration } from "../lib/format-duration";

export const GET: APIRoute = async () => {
  const site = import.meta.env.SITE || "https://litteratureaudio.pages.dev";
  const allBooks = await getCollection("books");
  const books = [...allBooks].sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime()).slice(0, 50);

  const escapeXml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

  const items = books.map((book) => {
    const d = book.data;
    const url = `${site}/livre-audio-gratuit-mp3/${d.slug}.html`;
    const firstTrack = d.tracks[0];
    const enclosure = firstTrack
      ? `<enclosure url="${escapeXml(firstTrack.url)}" length="${firstTrack.size || 0}" type="audio/mpeg" />`
      : "";
    return `
      <item>
        <title>${escapeXml(d.title)}</title>
        <link>${url}</link>
        <guid>${url}</guid>
        <pubDate>${d.publishedAt.toUTCString()}</pubDate>
        <description>${escapeXml(d.excerpt || `Livre audio gratuit ${d.title}`)}</description>
        ${enclosure}
        <itunes:duration>${Math.ceil(d.durationTotal / 60)}</itunes:duration>
      </item>
    `;
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Litteratureaudio.com</title>
    <link>${site}</link>
    <description>La référence du livre audio gratuit francophone : plus de 9000 livres audio à écouter et télécharger gratuitement au format MP3 !</description>
    <language>fr-FR</language>
    ${items.join("\n")}
  </channel>
</rss>`;

  return new Response(body, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
};
```

- [ ] **Step 4: Créer JsonLd.astro**

Créer `web/src/components/JsonLd.astro` :

```astro
---
interface Props {
  data: Record<string, unknown>;
}
const { data } = Astro.props;
---
<script type="application/ld+json" set:html={JSON.stringify(data)} />
```

- [ ] **Step 5: Ajouter JSON-LD sur la fiche livre**

Modifier `web/src/pages/livre-audio-gratuit-mp3/[slug].astro` pour importer et utiliser `JsonLd` :

```astro
import JsonLd from "../../components/JsonLd.astro";
```

Et dans `<Base>` :

```astro
<JsonLd
  slot="jsonld"
  data={{
    "@context": "https://schema.org",
    "@type": "Book",
    name: d.title,
    author: d.authors.map((a) => ({ "@type": "Person", name: a.name })),
    description: d.excerpt,
    image: d.cover?.url,
    datePublished: d.publishedAt.toISOString(),
    url: d.legacyUrl,
  }}
/>
```

Ajouter un slot `jsonld` dans `Base.astro` juste avant `</head>` :

```astro
<slot name="jsonld" />
```

- [ ] **Step 6: Récupérer les favicons**

Télécharger l'icône du site original :

```bash
cd web/public
curl -L -o favicon-32x32.png https://www.litteratureaudio.com/wp-content/uploads/cropped-litteratureaudio-icone-1-32x32.png
curl -L -o favicon-180x180.png https://www.litteratureaudio.com/wp-content/uploads/cropped-litteratureaudio-icone-1-180x180.png
curl -L -o favicon-192x192.png https://www.litteratureaudio.com/wp-content/uploads/cropped-litteratureaudio-icone-1-192x192.png
curl -L -o favicon-270x270.png https://www.litteratureaudio.com/wp-content/uploads/cropped-litteratureaudio-icone-1-270x270.png
```

Créer `web/public/favicon.ico` vide ou convertir une image en ICO si nécessaire. Pour Cloudflare Pages, les PNG suffisent.

- [ ] **Step 7: Vérifier le build**

```bash
cd web
pnpm exec astro check
```

- [ ] **Step 8: Commit**

```bash
git add web/src/layouts/Base.astro web/src/pages/robots.txt.ts web/src/pages/feed.xml.ts web/src/components/JsonLd.astro web/src/pages/livre-audio-gratuit-mp3/\[slug\].astro web/public/favicon*.png
git commit -m "feat(web): add RSS feed, Twitter Cards, favicons and JSON-LD"
```

---

## Task 8: Build complet et validation

**Files:**
- Aucun — seulement exécution.

- [ ] **Step 1: Fetch complet**

```bash
cd web
WP_API_BASE=https://www.litteratureaudio.com pnpm exec tsx scripts/fetch-content.ts
```

Expected : ~10 000 livres et toutes les taxonomies écrites.

- [ ] **Step 2: Build complet**

```bash
cd web
pnpm exec astro build
```

Expected : `dist/` généré sans erreur, contenant toutes les pages.

- [ ] **Step 3: Tests manuels**

1. Ouvrir `dist/index.html` : vérifier les cartes, la sidebar, le header.
2. Naviguer vers une fiche livre : vérifier le lecteur et les liens taxonomies.
3. Cliquer Play : vérifier le player global sticky.
4. Naviguer vers une autre page : vérifier que le player continue.
5. Vérifier `/feed.xml` et `/sitemap-index.xml`.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: complete V1 clone build and validation"
```

---

## Self-Review

**Spec coverage:**
- Lecteur audio inline + global ✓ (Tasks 3)
- Header / Sidebar / Footer / BookCard / fiche livre ✓ (Task 4)
- Pages par taxonomie ✓ (Task 5)
- Pages de classement + recherche ✓ (Task 6)
- SEO (Twitter Cards, RSS, favicons, JSON-LD) ✓ (Task 7)
- Build complet ✓ (Task 8)

**Placeholder scan:** aucun TBD/TODO.

**Type consistency:** `AudioBook`, `AudioTrack`, `AudioState` cohérents entre `types/audio.ts`, `AudioProvider.tsx`, `PlayButton.tsx`, `TrackList.tsx`, `GlobalPlayer.tsx`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-29-litteratureaudio-clone-fidele-v1-implementation.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — I execute tasks in this session using `executing-plans`, batch execution with checkpoints.

**Which approach?**
