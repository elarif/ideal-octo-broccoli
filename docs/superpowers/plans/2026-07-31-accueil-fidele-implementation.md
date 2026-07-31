# Page d'accueil fidèle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir la page d'accueil avec le lien "Voir toutes les nouveautés", la section "Le Choix de Claryssandre", le bloc newsletter statique et le placeholder "Derniers commentaires".

**Architecture:** La page `index.astro` reste statique Astro. On ajoute un tableau de slugs pour la sélection éditoriale, on réordonne les sections, on crée un petit composant React pour le formulaire newsletter (`client:visible`), et on ajoute un composant Astro placeholder pour les commentaires.

**Tech Stack:** Astro 4, React 18, Tailwind CSS 3, TypeScript strict.

## Global Constraints

- Pas de backend en V1 : le formulaire newsletter est purement frontal et n'envoie aucune donnée.
- Réutiliser `BookCard.astro` pour toutes les grilles de livres.
- Les liens internes utilisent les URLs statiques `.html` déjà en place.
- Pas de changement de structure de données (`content/config.ts`) : tout se fait avec les collections existantes.

---

### Task 1: Créer le composant newsletter

**Files:**
- Create: `web/src/components/Newsletter.tsx`

**Interfaces:**
- Consumes: none
- Produces: `export default function Newsletter()` — composant React autonome sans props.

- [ ] **Step 1: Write the failing usage**

  In `web/src/pages/index.astro`, add:

  ```astro
  import Newsletter from "../components/Newsletter.tsx";
  ```

  and place `<Newsletter client:visible />` in a section.

  Run: `cd web && npx astro check`
  Expected: FAIL — `Newsletter.tsx` does not exist.

- [ ] **Step 2: Create the component**

  ```tsx
  // web/src/components/Newsletter.tsx
  import { useState } from "react";

  export default function Newsletter() {
    const [email, setEmail] = useState("");
    const [subscribed, setSubscribed] = useState(false);

    return (
      <div className="bg-gray-50 border rounded p-4">
        <h3 className="font-bold text-lg mb-2">Newsletter</h3>
        <p className="text-sm text-gray-600 mb-3">
          Recevez les dernières nouveautés du livre audio gratuit.
        </p>
        {subscribed ? (
          <p className="text-sm text-green-700">Merci pour votre inscription !</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubscribed(true);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Votre adresse email"
              className="flex-1 border rounded px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90"
            >
              S'inscrire
            </button>
          </form>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Inscription fictive en V1 — fonctionnalité active à venir.
        </p>
      </div>
    );
  }
  ```

- [ ] **Step 3: Run astro check**

  Run: `cd web && npx astro check`
  Expected: PASS.

- [ ] **Step 4: Commit**

  ```bash
  git add web/src/components/Newsletter.tsx web/src/pages/index.astro
  git commit -m "feat(web): add static newsletter component"
  ```

---

### Task 2: Créer le composant placeholder "Derniers commentaires"

**Files:**
- Create: `web/src/components/LatestCommentsPlaceholder.astro`

**Interfaces:**
- Consumes: none
- Produces: composant Astro sans props.

- [ ] **Step 1: Create the component**

  ```astro
  ---
  // web/src/components/LatestCommentsPlaceholder.astro
  ---
  <section class="border-t pt-6 mt-8">
    <h2 class="text-xl font-bold mb-3">Derniers commentaires</h2>
    <p class="text-gray-600 text-sm">Les commentaires seront disponibles prochainement.</p>
  </section>
  ```

- [ ] **Step 2: Use it in index.astro**

  Add:

  ```astro
  import LatestCommentsPlaceholder from "../components/LatestCommentsPlaceholder.astro";
  ```

  and place `<LatestCommentsPlaceholder />` near the bottom.

- [ ] **Step 3: Run astro check**

  Run: `cd web && npx astro check`
  Expected: PASS.

- [ ] **Step 4: Commit**

  ```bash
  git add web/src/components/LatestCommentsPlaceholder.astro web/src/pages/index.astro
  git commit -m "feat(web): add latest comments placeholder on home"
  ```

---

### Task 3: Restructurer la page d'accueil

**Files:**
- Modify: `web/src/pages/index.astro`

**Interfaces:**
- Consumes: `BookCard`, `Newsletter`, `LatestCommentsPlaceholder`, `getCollection("books")`.
- Produces: page d'accueil enrichie.

- [ ] **Step 1: Add imports and selection data**

  Replace the current frontmatter of `web/src/pages/index.astro` with:

  ```astro
  ---
  import { getCollection } from "astro:content";
  import Base from "../layouts/Base.astro";
  import BookCard from "../components/BookCard.astro";
  import Newsletter from "../components/Newsletter.tsx";
  import LatestCommentsPlaceholder from "../components/LatestCommentsPlaceholder.astro";

  const allBooks = await getCollection("books");
  const bySlug = new Map(allBooks.map((b) => [b.data.slug, b]));
  const sortedByDate = [...allBooks].sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );
  const nouveautes = sortedByDate.slice(0, 8);
  const populaires = [...allBooks].sort((a, b) => b.data.views - a.data.views).slice(0, 12);

const choixClaryssandreSlugs = [
  "victor-hugo-notre-dame-de-paris",
  "gustave-flaubert-madame-bovary",
  "jules-verne-voyage-au-centre-de-la-terre",
  "alexandre-dumas-les-trois-mousquetaires",
];
  const choixClaryssandre = choixClaryssandreSlugs
    .map((slug) => bySlug.get(slug))
    .filter((b): b is NonNullable<typeof b> => Boolean(b));
  ---
  ```

- [ ] **Step 2: Rewrite the body**

  Replace the entire `<Base>...</Base>` body with:

  ```astro
  <Base
    title={`Plus de ${allBooks.length} livres audio gratuits ! | Litteratureaudio.com`}
    description={`La référence du livre audio gratuit francophone : plus de ${allBooks.length} livres audio à écouter et télécharger gratuitement au format MP3 !`}
  >
    <section class="mb-10">
      <div class="flex items-baseline justify-between mb-4">
        <h2 class="text-2xl font-bold">Nouveautés</h2>
        <a
          href="/nos-derniers-livres-audio-gratuits.html"
          class="text-primary hover:underline text-sm"
        >
          Voir toutes les nouveautés →
        </a>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        {nouveautes.map((book) => (
          <BookCard book={book} />
        ))}
      </div>
    </section>

    {choixClaryssandre.length > 0 && (
      <section class="mb-10">
        <h2 class="text-2xl font-bold mb-4">Le Choix de Claryssandre</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          {choixClaryssandre.map((book) => (
            <BookCard book={book} />
          ))}
        </div>
      </section>
    )}

    <section class="mb-10">
      <h2 class="text-2xl font-bold mb-4">Les plus aimés</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        {populaires.map((book) => (
          <BookCard book={book} />
        ))}
      </div>
    </section>

    <section class="mb-10">
      <Newsletter client:visible />
    </section>

    <LatestCommentsPlaceholder />
  </Base>
  ```

- [ ] **Step 3: Run astro check**

  Run: `cd web && npx astro check`
  Expected: PASS.

- [ ] **Step 4: Build**

  Run: `cd web && npm run build`
  Expected: PASS with home page generated.

- [ ] **Step 5: Commit**

  ```bash
  git add web/src/pages/index.astro
  git commit -m "feat(web): restructure home with news link, choix claryssandre and newsletter"
  ```

---

## Self-Review

1. **Spec coverage:**
   - Lien "Voir toutes les nouveautés" → Task 3, Step 2.
   - "Le Choix de Claryssandre" → Task 3, Step 1 + Step 2.
   - Newsletter statique → Task 1.
   - Placeholder commentaires → Task 2.

2. **Placeholder scan:** Aucun TBD/TODO ; les slugs et les chemins sont exacts.

3. **Type consistency:** `choixClaryssandre` est filtré avec un type guard, `bySlug` est une `Map<string, CollectionEntry<"books">>`.
