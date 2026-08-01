# Fiche livre V3 — Téléchargements, portrait auteur, commentaires placeholder

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir la fiche livre avec le lien « Consulter la version texte », un bouton de téléchargement ZIP côté client, le portrait de l’auteur avec source, et un placeholder de commentaires fidèle au site original.

**Architecture:** On ajoute `textUrl` et `downloadUrl` aux données de livre (récupérés depuis `post.meta` et parsés depuis `post.content`), ainsi qu’un portrait d’auteur récupéré depuis la page auteur. Le ZIP est généré côté client via `jszip` dans une île React. Les placeholders commentaires / abonnés sont statiques.

**Tech Stack:** Astro 4, React 18, Tailwind CSS 3, TypeScript strict, jszip.

## Global Constraints

- Pas de backend en V1 : le ZIP est généré dans le navigateur, les commentaires sont un placeholder.
- Les URLs internes utilisent `pageUrl()` de `lib/urls.ts`.
- Aucune régression sur le lecteur audio, les listes, la pagination ou le design system.
- `astro check` à 0 erreur et build réussi après chaque task.
- Déploiement avec `FETCH_LIMIT=500` pour cette itération.

---

### Task 1: Ajouter `textUrl` et `downloadUrl` au fetch et au schéma

**Files:**
- Modify: `web/scripts/fetch-content.ts`
- Modify: `web/src/content/config.ts`
- Modify: `web/src/types/audio.ts` (optionnel — si on ajoute ces champs à `AudioBook`)

**Interfaces:**
- Produces: `book.downloadUrl?: string` et `book.textUrl?: string` dans les JSON de collection.

- [ ] **Step 1: Add fields to content schema**

  In `web/src/content/config.ts`, in the `books` schema, add:

  ```ts
  downloadUrl: z.string().url().optional(),
  textUrl: z.string().url().optional(),
  ```

- [ ] **Step 2: Extract text URL from post content**

  In `web/scripts/fetch-content.ts`, add a helper:

  ```ts
  function extractTextUrl(content: string): string | undefined {
    const match = content.match(/href="(https?:\/\/[^"]*(?:wikisource|gutenberg|ebooks|bnf|gallica)[^"]*)"/i);
    return match?.[1];
  }
  ```

  Also capture `post.meta?.download_url`.

- [ ] **Step 3: Store fields in the book payload**

  In the book object written to JSON, add:

  ```ts
  downloadUrl: post.meta?.download_url || undefined,
  textUrl: extractTextUrl(post.content.rendered),
  ```

- [ ] **Step 4: Run astro check + build**

- [ ] **Step 5: Commit**

  ```bash
  git add web/src/content/config.ts web/scripts/fetch-content.ts
  git commit -m "feat(web): add downloadUrl and textUrl to book schema and fetch"
  ```

---

### Task 2: Ajouter le portrait auteur au fetch des taxonomies

**Files:**
- Modify: `web/src/lib/fetch-taxonomies.ts`
- Modify: `web/src/content/config.ts` (term collection schema)

**Interfaces:**
- Produces: `portrait?: { url: string; alt: string }` on author JSON.

- [ ] **Step 1: Add portrait field to term schema**

  In `web/src/content/config.ts`, in `termCollection`, add:

  ```ts
  portrait: z.object({ url: z.string().url(), alt: z.string().default("") }).optional(),
  ```

- [ ] **Step 2: Fetch author page HTML and extract portrait**

  In `web/src/lib/fetch-taxonomies.ts`, add:

  ```ts
  import { wpClient } from "./wp-client";

  function extractPortrait(html: string, name: string): { url: string; alt: string } | undefined {
    const re = /<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi;
    let m;
    while ((m = re.exec(html))) {
      const [_, url, alt] = m;
      const lowAlt = alt.toLowerCase();
      const lowUrl = url.toLowerCase();
      if (
        (lowAlt.includes(name.toLowerCase()) && lowAlt.match(/portrait|photo|gravure|illustration/)) ||
        lowUrl.match(/portrait/)
      ) {
        return { url, alt };
      }
    }
    return undefined;
  }
  ```

  Use `wpClient.reqRaw` or `fetch` to get the author page HTML. Since `wp-client.ts` only has JSON helpers, add a simple `fetchHtml` helper in `fetch-taxonomies.ts`:

  ```ts
  async function fetchAuthorPortrait(slug: string, name: string): Promise<{ url: string; alt: string } | undefined> {
    try {
      const url = `https://www.litteratureaudio.com/livre-audio-gratuit-mp3/auteur/${slug}`;
      const resp = await fetch(url, { headers: { accept: "text/html" } });
      if (!resp.ok) return undefined;
      const html = await resp.text();
      return extractPortrait(html, name);
    } catch {
      return undefined;
    }
  }
  ```

- [ ] **Step 3: Only fetch portrait for authors**

  In `fetchTaxonomies`, when `wpTaxonomy === "auteur"`, call `fetchAuthorPortrait(slug, term.name)` and include in payload.

- [ ] **Step 4: Run astro check + build**

- [ ] **Step 5: Commit**

  ```bash
  git add web/src/lib/fetch-taxonomies.ts web/src/content/config.ts
  git commit -m "feat(web): fetch author portrait from author page html"
  ```

---

### Task 3: Ajouter jszip et le composant ZipDownloadButton

**Files:**
- Modify: `web/package.json`
- Create: `web/src/components/ZipDownloadButton.tsx`

**Interfaces:**
- `ZipDownloadButton`: Props `{ title: string; tracks: Array<{ title: string; url: string }> }`

- [ ] **Step 1: Install jszip**

  Run: `cd /home/elarif/litteratureaudio/web && pnpm add jszip`

- [ ] **Step 2: Create ZipDownloadButton.tsx**

  ```tsx
  import { useState } from "react";
  import JSZip from "jszip";
  import { Download } from "lucide-react";

  interface Track {
    title: string;
    url: string;
  }

  interface Props {
    title: string;
    tracks: Track[];
  }

  export function ZipDownloadButton({ title, tracks }: Props) {
    const [busy, setBusy] = useState(false);

    const handleClick = async () => {
      if (busy || tracks.length === 0) return;
      setBusy(true);
      try {
        const zip = new JSZip();
        const folder = zip.folder(title.replace(/[/\\:?*"<>|]/g, "-")) || zip;
        await Promise.all(
          tracks.map(async (track, i) => {
            const resp = await fetch(track.url);
            if (!resp.ok) throw new Error(`Failed to fetch ${track.url}`);
            const blob = await resp.blob();
            const ext = track.url.split(".").pop()?.replace(/\?.*$/, "") || "mp3";
            const fileName = `${String(i + 1).padStart(2, "0")}_${track.title.replace(/[/\\:?*"<>|]/g, "-")}.${ext}`;
            folder.file(fileName, blob);
          })
        );
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.replace(/[/\\:?*"<>|]/g, "-")}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        alert("Le téléchargement du ZIP a échoué.");
        console.error(e);
      } finally {
        setBusy(false);
      }
    };

    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || tracks.length === 0}
        className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded hover:bg-primary/90 disabled:opacity-50"
      >
        <Download size={18} />
        {busy ? "Préparation…" : "Télécharger tout (ZIP)"}
      </button>
    );
  }
  ```

- [ ] **Step 3: Run astro check + build**

- [ ] **Step 4: Commit**

  ```bash
  git add web/package.json web/src/components/ZipDownloadButton.tsx pnpm-lock.yaml
  git commit -m "feat(web): add jszip and client-side zip download button"
  ```

---

### Task 4: Enrichir la fiche livre

**Files:**
- Modify: `web/src/pages/livre-audio-gratuit-mp3/[slug].astro`
- Create: `web/src/components/CommentsPlaceholder.astro`

**Interfaces:**
- Consumes: `downloadUrl`, `textUrl`, author `portrait`, `ZipDownloadButton`.

- [ ] **Step 1: Create CommentsPlaceholder.astro**

  ```astro
  ---
  interface Props {
    count?: number;
  }
  const { count = 0 } = Astro.props;
  ---
  <section class="border-t pt-6 mt-8">
    <h2 class="text-xl font-bold mb-3">Commentaires</h2>
    <p class="text-gray-600 text-sm mb-4">
      {count > 0 ? `${count} commentaire${count > 1 ? "s" : ""} — ` : ""}Les commentaires seront disponibles prochainement.
    </p>
    <p class="text-sm text-gray-500">
      <a href="#" class="text-primary hover:underline">Se connecter</a> pour laisser un commentaire.
      <span class="ml-2 text-xs">(Fonctionnalité active à venir)</span>
    </p>
  </section>
  ```

- [ ] **Step 2: Update [slug].astro to load author portrait and display new sections**

  Add imports:

  ```astro
  import { ZipDownloadButton } from "../../components/ZipDownloadButton";
  import CommentsPlaceholder from "../../components/CommentsPlaceholder.astro";
  import Button from "../../components/ui/Button.astro";
  ```

  In the frontmatter, load the first author’s portrait:

  ```astro
  const authorSlug = d.authors[0]?.slug;
  const authorEntry = authorSlug ? await getCollection("authors").then((all) => all.find((a) => a.data.slug === authorSlug)) : undefined;
  const authorPortrait = authorEntry?.data.portrait;
  ```

  Add a download section after the header or inside the "Écouter / Télécharger" section:

  ```astro
  {d.tracks.length > 0 && (
    <Section title="Écouter / Télécharger">
      <div class="flex flex-wrap gap-3 mb-4">
        <ZipDownloadButton client:visible title={d.title} tracks={audioBook.tracks.map((t) => ({ title: t.title, url: t.url }))} />
        {d.downloadUrl && (
          <Button href={d.downloadUrl} variant="ghost">
            <span class="inline-flex items-center gap-2">
              <Download size={18} />
              Télécharger le MP3
            </span>
          </Button>
        )}
        {d.textUrl && (
          <Button href={d.textUrl} variant="link">Consulter la version texte →</Button>
        )}
      </div>
      <TrackList client:load book={audioBook} />
    </Section>
  )}
  ```

  Add author portrait section in the header or after metadata:

  ```astro
  {authorPortrait && (
    <div class="mt-4 flex items-start gap-3">
      <img src={authorPortrait.url} alt={authorPortrait.alt} class="w-20 h-24 object-cover rounded shadow" />
      <div>
        <p class="text-sm font-medium">{d.authors[0]?.name}</p>
        <p class="text-xs text-gray-500">{authorPortrait.alt}</p>
      </div>
    </div>
  )}
  ```

  Add comments placeholder at the bottom:

  ```astro
  <CommentsPlaceholder count={d.commentCount} />
  ```

- [ ] **Step 3: Run astro check + build**

- [ ] **Step 4: Commit**

  ```bash
  git add web/src/pages/livre-audio-gratuit-mp3/[slug].astro web/src/components/CommentsPlaceholder.astro
  git commit -m "feat(web): add zip download, text version link, author portrait and comments placeholder to book page"
  ```

---

### Task 5: Build, vérifier et déployer

- [ ] **Step 1: Run full local build**

  ```bash
  cd /home/elarif/litteratureaudio/web
  WP_API_BASE=https://www.litteratureaudio.com FETCH_LIMIT=500 pnpm --filter @la/web run build
  ```

- [ ] **Step 2: Verify generated pages**

  Check that a book page contains the new buttons and portrait.

- [ ] **Step 3: Push and deploy**

  ```bash
  cd /home/elarif/litteratureaudio
  git push origin main
  ```

  Wait for GitHub Actions to deploy.

- [ ] **Step 4: Smoke-test production URLs**

  - https://litteratureaudio.pages.dev/livre-audio-gratuit-mp3/jules-verne-deux-ans-de-vacances.html
  - https://litteratureaudio.pages.dev/livre-audio-gratuit-mp3/victor-hugo-ce-quon-entend-sur-la-montagne.html

---

## Self-Review

1. **Spec coverage:**
   - ZIP download → Task 3 + Task 4
   - Version texte → Task 1 + Task 4
   - Portrait auteur → Task 2 + Task 4
   - Commentaires placeholder → Task 4

2. **Placeholder scan:** Aucun TBD/TODO.

3. **Type consistency:** `downloadUrl` et `textUrl` sont des `string | undefined`. `portrait` est optionnel. `ZipDownloadButton` reçoit `AudioBook.tracks` mappés.
