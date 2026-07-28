# Refonte litteratureaudio.com — MVP V0 : Front statique Astro sur Cloudflare Pages

| Champ | Valeur |
|---|---|
| Document ID | `SPEC-LA-MVP-V0-001` |
| Révision | 1 |
| Date d'effet | 2026-07-28 |
| Propriétaire | Refonte litteratureaudio.com |
| Approbateur | Utilisateur (brainstorming) |
| Type | Spec de conception MVP |
| Source | Brainstorming du 2026-07-28 |

## Public

**Primaire** : le contributeur technique chargé d'implémenter le MVP V0 de la refonte.
**Secondaire** : les reviewers et mainteneurs des versions futures.
**Niveau** : intermédiaire — le lecteur sait déjà construire un site statique avec Astro et Tailwind.

## Objet / Périmètre

**Objet** : livrer une première version visible et déployée gratuitement du futur front public de litteratureaudio.com.

**Couvre** :
- Un front Astro 5 statique (SSG).
- Une source de données unique : l'API REST publique de WordPress.
- Un déploiement automatique sur Cloudflare Pages via GitHub.
- Les pages et composants strictement nécessaires pour présenter le site.

**Ne couvre PAS** :
- Le lecteur audio interactif.
- La recherche.
- Le thème sombre.
- Les pages de classement (auteur/voix/genre).
- Le Cloudflare Worker de cache.
- L'API custom, PostgreSQL, Drizzle, la migration one-shot.
- Le cahier des charges d'optimisation WordPress — document autonome déjà existant.

## Définitions

| Terme | Sens |
|---|---|
| MVP V0 | Minimum Viable Product, version 0. |
| SSG | Static Site Generation — pages HTML pré-rendues au build. |
| WP API | API REST publique de WordPress existante. |

## Décisions de cadrage

| Question | Décision |
|---|---|
| Périmètre V0 | Home + fiche livre + 404 + robots + sitemap. Rien de plus. |
| Source de données | API REST publique de WordPress, directement. |
| Framework front | Astro 5 + Tailwind CSS 3. |
| Hébergement | Cloudflare Pages (gratuit), URL `*.pages.dev`. |
| Images | URLs d'origine WP ; pas de transformation pour V0. |
| CI/CD | Déploiement automatique Cloudflare Pages sur push `main`. Pas de GitHub Actions custom pour V0. |
| Tests | Pas de tests automatisés pour V0 ; vérification manuelle du build et du déploiement. |

## 1. Architecture

```
GitHub repo
  ↓ push main
Cloudflare Pages (build)
  ↓ pnpm build
Astro fetch WP REST API
  ↓ scripts/fetch-content.ts
src/content/books/*.json
  ↓ astro build
dist/ (HTML statique)
  ↓ CDN Cloudflare Pages
URL *.pages.dev
```

## 2. Périmètre fonctionnel V0

### 2.1 Pages statiques générées au build

| Route | Fichier | Contenu |
|---|---|---|
| `/` | `src/pages/index.astro` | Header, Nouveautés (8 livres), Les plus aimés (12 livres), total livres, footer. |
| `/livre-audio-gratuit-mp3/[slug].html` | `src/pages/livre-audio-gratuit-mp3/[slug].astro` | Fiche livre : cover, titre, auteur(s), voix, genre, durée, description, pistes MP3 avec téléchargement. |
| `/404` | `src/pages/404.astro` | Page d'erreur. |
| `/robots.txt` | `src/pages/robots.txt.ts` | Robots.txt. |
| `/sitemap-index.xml` | généré par `@astrojs/sitemap` | Sitemap. |

### 2.2 Hors périmètre V0

- Lecteur audio, recherche, thème sombre.
- Classements par auteur/voix/genre.
- Redirections WordPress complexes.
- Analytics (on utilisera Cloudflare Web Analytics natif une fois déployé).

## 3. Contraintes globales

- **Langue** : français (fr-FR).
- **URLs** : identiques à WordPress pour les fiches (`/livre-audio-gratuit-mp3/<slug>.html`).
- **SEO de base** : title, meta description, canonical, OpenGraph.
- **Polices** : système uniquement.
- **Images** : URLs d'origine WP, attributs `width`/`height` systématiques, `loading="lazy"` sauf LCP.
- **RGPD** : pas d'analytics tierce pour V0.
- **Licence** : MIT pour le code.
- **Node** ≥ 20.11, **pnpm** ≥ 9.

## 4. Modèle de données

### 4.1 Content Collections Astro (Zod)

Une seule collection pour V0 : `books`.

```typescript
const books = defineCollection({
  type: "data",
  schema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
    title: z.string(),
    excerpt: z.string().default(""),
    content: z.string().default(""),
    cover: z.object({
      url: z.string().url(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      alt: z.string().default(""),
    }).optional(),
    durationTotal: z.number().int().nonnegative(),
    authors: z.array(z.object({ id: z.number(), slug: z.string(), name: z.string() })),
    voices: z.array(z.object({ id: z.number(), slug: z.string(), name: z.string() })),
    genres: z.array(z.object({ id: z.number(), slug: z.string(), name: z.string() })),
    tracks: z.array(z.object({
      id: z.number(),
      slug: z.string().default(""),
      title: z.string(),
      order: z.number(),
      url: z.string().url(),
      duration: z.number().int().nonnegative(),
      size: z.number().int().nonnegative(),
    })),
    views: z.number().int().nonnegative().default(0),
    publishedAt: z.coerce.date(),
    modifiedAt: z.coerce.date(),
    legacyUrl: z.string().url(),
  }),
});

export const collections = { books };
```

### 4.2 Script d'hydratation

`scripts/fetch-content.ts` :
- Appelle `/wp-json/wp/v2/posts?per_page=100&_embed=1` en paginant.
- Pour chaque post, appelle `/wp-json/wp/v2/media?parent=<id>` pour récupérer les pistes audio.
- Écrit les fichiers JSON dans `src/content/books/`.

## 5. Composants

| Composant | Type | Rôle |
|---|---|---|
| `Base.astro` | Layout | SEO, header, footer. |
| `Header.astro` | Composant | Navigation principale. |
| `Footer.astro` | Composant | Liens pied de page. |
| `BookCard.astro` | Composant | Carte livre sur la home. |
| `Picture.astro` | Composant | Image responsive avec srcset AVIF/WebP/JPG. |

## 6. Build et déploiement

### 6.1 Scripts `package.json`

```json
{
  "fetch:content": "tsx scripts/fetch-content.ts",
  "prebuild": "pnpm fetch:content",
  "build": "astro build",
  "dev": "astro dev",
  "check": "astro check"
}
```

### 6.2 Cloudflare Pages

- Framework preset : `Astro`.
- Build command : `pnpm build`.
- Build output directory : `dist`.
- Environment variable : `WP_API_BASE=https://www.litteratureaudio.com`.

## 7. Gestion d'erreur

- Si `fetch-content.ts` échoue, le build échoue. Pas de déploiement d'un site incomplet.
- Si une fiche manque des pistes audio, la fiche affiche quand même le livre sans lecteur.
- 404 Astro native pour les slugs inexistants.

## 8. Définition de fini V0

1. Home et fiche livre fonctionnels et rendus en SSG.
2. URLs WordPress préservées pour les fiches.
3. Sitemap et robots.txt générés.
4. Site déployé et accessible sur `*.pages.dev`.
5. Build réussi en local et sur Cloudflare Pages.

## Références

- `docs/superpowers/specs/2026-07-28-refonte-litteratureaudio-couche1-design.md` — spec complète Couche 1 (utilisée comme roadmap future, pas comme périmètre V0).
- `docs/wordpress-optimizations.md` — cahier des charges Phase 0 (autonome).

## Historique des révisions

| Rev | Date | Description | Auteur | Approbateur |
|---|---|---|---|---|
| 1 | 2026-07-28 | Création. MVP V0 : Astro + WP direct + Cloudflare Pages. | Refonte litteratureaudio.com | Utilisateur |
