# Refonte litteratureaudio.com — Couche 1 : Front public (visiteur anonyme)

| Champ | Valeur |
|---|---|
| Document ID | `SPEC-LA-C1-001` |
| Révision | 1 |
| Date d'effet | 2026-07-28 |
| Propriétaire | Refonte litteratureaudio.com |
| Approbateur | Utilisateur (brainstorming) |
| Type | Spec de conception |
| Source | Brainstorming du 2026-07-28 |

## Public

**Primaire** : le contributeur technique chargé d'implémenter la Couche 1 de la refonte de litteratureaudio.com.
**Secondaire** : les reviewers du plan d'implémentation ; les mainteneurs des Couches 2 et 3 qui s'appuient sur les fondations posées ici.
**Niveau** : intermédiaire — le lecteur construit déjà des applications TypeScript/React et connaît le rendu statique.
**Ce qu'il sait déjà** : Astro, React, Postgres, GitHub Actions, Cloudflare.
**Ce qu'il doit apprendre** : le découpage en couches, les budgets perf bloquants, le schéma de données, la stratégie de migration one-shot.

## Objet / Périmètre

**Objet** : spécifier la réécriture complète de litteratureaudio.com, abordée par couches incrémentales. Ce document couvre **uniquement la Couche 1** : le front public statique destiné au visiteur anonyme.

**Couvre** :
- L'architecture globale (3 couches + transition WordPress).
- Le périmètre fonctionnel détaillé de la Couche 1 (pages, islands, contraintes).
- Le modèle de données Postgres + Content Collections Astro.
- L'API custom et les islands React (Player, SearchBox, ThemeToggle).
- Le build, le CI/CD, l'hébergement et l'observabilité.
- La gestion d'erreur, la stratégie de tests et la définition de fini.

**Ne couvre PAS** :
- La Couche 2 (donneurs de voix / contribution) — spec séparé.
- La Couche 3 (communauté / forums / profil) — spec séparé.
- Le back-office custom React — spécifié dans la Couche 2.
- Le cahier des charges d'optimisation WordPress `docs/wordpress-optimizations.md` — autonome, à remettre à l'admin WP pour la période transitoire.
- Le plan d'implémentation tâche par tâche — produit par le skill `writing-plans` à partir de ce spec.

## Définitions

| Terme | Sens |
|---|---|
| Couche | Un périmètre fonctionnel indépendant, doté de son spec → plan → implémentation. Couches 1, 2, 3. |
| SSG | Static Site Generation — pages HTML pré-rendues au build, servies telles quelles par un CDN. |
| Island | Composant React hydraté individuellement dans une page par ailleurs statique (Astro islands). |
| Cutover | Bascule de la production de l'ancien site (WordPress) vers le nouveau front. |
| One-shot migration | Export unique WP → import Postgres exécuté au cutover, sans sync bidirectionnelle. |
| Budget perf | Seuil de performance non négociable, vérifié en CI ; un dépassement bloque le deploy. |
| LCP | Largest Contentful Paint — métrique Lighthouse. |
| TBT | Total Blocking Time — métrique Lighthouse. |
| CLS | Cumulative Layout Shift — métrique Lighthouse. |
| DoD | Definition of Done — critères de fin de la Couche 1. |
| WP | WordPress existant, source de vérité pendant la transition. |
| Drizzle | ORM TypeScript-first pour Postgres, migrations versionnées. |

## Décisions de cadrage (brainstorming)

| Question | Décision |
|---|---|
| Périmètre global de la réécriture | Full parity, par couches incrémentales. |
| Rôle de WordPress | Remplacer WP totalement (front + back-office). |
| Back-office cible | Back custom sur-mesure (spec Couche 2). |
| Mode de rendu front public | SSG + islands (statique + interactivité ciblée). |
| Framework front | Astro 5 (public) + React/Vite (admin, Couche 2). |
| Base de données | PostgreSQL managé (Neon) + Drizzle ORM. |
| Hébergement | Cloudflare Pages (public) + Fly.io/Railway (admin+API). |
| Migration des données | One-shot : export WP → import Postgres au cutover. |

## 1. Architecture globale

### 1.1 Schéma de déploiement

```
┌─────────────────────────────────────────────────────────────────┐
│  Visiteur (browser)                                             │
│   ↓ HTML statique + islands JS (lecteur, recherche)             │
├─────────────────────────────────────────────────────────────────┤
│  Cloudflare Pages  ← 10 000 pages HTML + assets (CDN global)    │
│   ↑ build par GitHub Actions (push main + webhook WP save_post) │
├─────────────────────────────────────────────────────────────────┤
│  Astro 5 (front public)  ← SSG, Content Collections Zod         │
│   islands React : <Player/>, <SearchBox/>, <ThemeToggle/>       │
├─────────────────────────────────────────────────────────────────┤
│  API REST custom (Fastify ou Hono sur Fly.io)                   │
│   ← alimente le back-office React (Couche 2)                   │
│   ← expose /api/search, /api/books/:slug, /api/views/:id        │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Neon, managé)  ← Drizzle ORM, migrations versionnées│
│   schéma : books, authors, voices, genres, tracks, periods,    │
│           regions, licenses (+ users, forum en Couches 2/3)     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Découpage en 3 couches

Chaque couche dispose de son propre spec, plan d'implémentation et cycle de livraison. Les couches sont livrées séquentiellement, mais le schéma de données et l'API sont conçus dès le départ pour accueillir les 3.

- **Couche 1 — Visiteur anonyme** (présent spec) : home, fiches livre, classements (auteur/voix/genre/période), recherche, lecteur audio, sitemap, SEO, 404.
- **Couche 2 — Donneurs de voix / contribution** : upload multi-étapes, pipeline de validation, calendrier de publication, dashboard contributeur, back-office React custom.
- **Couche 3 — Communauté** : forums, profil utilisateur, favoris, login/inscription, modération.

### 1.3 Transition WordPress

- Pendant la Couche 1, WordPress reste le back-office en lecture : Astro build consomme l'API REST publique de WP (`/wp-json/wp/v2/posts`, `/media`, taxonomies). Un Cloudflare Worker (décrit dans `docs/superpowers/plans/2026-07-19-refonte-litteratureaudio-foundation.md`) met en cache les réponses (stale-while-revalidate) pour tolérer le TTFB WP de 1,4–10,6 s.
- Le script one-shot d'export WP → Postgres (`scripts/migrate-wp-to-pg.ts`) s'exécute au cutover de la Couche 2, lorsque le back-office custom est prêt à recevoir les écritures.
- Au cutover de la Couche 1, le front public bascule de WP vers le nouveau Astro sur `www.litteratureaudio.com`. WordPress reste accessible sur `admin.litteratureaudio.com` (sous-domaine privé) pour la contribution et l'admin pendant les Couches 2/3.

## 2. Périmètre fonctionnel de la Couche 1

### 2.1 Pages statiques générées au build (SSG)

| Route Astro | Fichier | Contenu |
|---|---|---|
| `/` | `src/pages/index.astro` | Home : Nouveautés (8 cartes), Les plus aimés (12), total livres, header/nav/footer |
| `/livre-audio-gratuit-mp3/[slug].html` | `src/pages/livre-audio-gratuit-mp3/[slug].astro` | Fiche livre : cover, titre, auteur, voix, genre, période, licence, durée, lecteur audio, description, liste pistes (download), JSON-LD Audiobook |
| `/nos-derniers-livres-audio-gratuits` | `src/pages/nos-derniers-livres-audio-gratuits.astro` | Liste paginée Nouveautés (rebuild incrémental) |
| `/classement-de-nos-livres-audio-gratuits-les-plus-apprecies` | `src/pages/classement-...-les-plus-apprecies.astro` | Top par vues |
| `/notre-bibliotheque-de-livres-audio-gratuits` | `src/pages/notre-bibliotheque-de-livres-audio-gratuits.astro` | Index par genre (liens vers `/genre/[slug]`) |
| `/classement-de-nos-livres-audio-gratuits-par-auteur` | `src/pages/classement-...-par-auteur.astro` | Index alphabétique auteurs → `/auteur/[slug]` |
| `/classement-de-nos-livres-audio-gratuits-par-donneur-ou-donneuse-de-voix` | `src/pages/classement-...-par-donneur-ou-donneuse-de-voix.astro` | Index alphabétique voix → `/voix/[slug]` |
| `/auteur/[slug]` | `src/pages/auteur/[slug].astro` | Liste livres de l'auteur, paginée |
| `/voix/[slug]` | `src/pages/voix/[slug].astro` | Liste livres du donneur de voix, paginée |
| `/genre/[slug]` | `src/pages/genre/[slug].astro` | Liste livres du genre, paginée |
| `/recherche` | `src/pages/recherche.astro` | Recherche full-text + facettes (genre/auteur/voix/période) — island React qui interroge l'API au clic (pas SSG) |
| `/404` | `src/pages/404.astro` | Page d'erreur |
| `/robots.txt` | `src/pages/robots.txt.ts` | Endpoint SEO |
| `/sitemap-index.xml` | `@astrojs/sitemap` | Sitemap XML couvrant 100 % des pages |
| `/feed` | `src/pages/feed.xml.ts` | RSS (remplace `/feed` WP) |

### 2.2 Interactivité (islands React)

Hydratation `client:idle` sauf mention contraire. Budget JS total < 30 Ko gzip sur home et fiche.

| Island | Hydratation | Rôle | Budget gzip |
|---|---|---|---|
| `<Player/>` | `client:visible` | Lecture séquentielle des pistes, mémorisation progression (localStorage), contrôle vitesse, skip ±15s, téléchargement piste | < 8 Ko |
| `<SearchBox/>` | `client:idle` | Autocomplétion live (debounce 200 ms, appelle `/api/search`), redirige vers `/recherche?q=...`, navigation clavier | < 4 Ko |
| `<ThemeToggle/>` | `client:idle` | Mode clair/sombre persisté localStorage, `class="dark"` sur `<html>` | < 1 Ko |

Total JS public : Player (8) + SearchBox (4) + ThemeToggle (1) + runtime Astro (~3) = ~16 Ko gzip → sous le budget 30 Ko.

### 2.3 Hors périmètre Couche 1 (redirections 301 vers WP existant)

Pendant la Couche 1, les routes suivantes restent servies par WordPress via redirection 301 :

- `/forums/*` → WP (Couche 3)
- `/membres/*` → WP (Couche 3)
- `/connexion` → WP (Couche 3)
- `/inscription` → WP (Couche 3)
- `/profil` → WP (Couche 3)
- `/wp-admin/*` → WP (Couche 2/3)
- `/creer/*` (contribution donneurs de voix) → WP (Couche 2)
- `/calendrier-des-publications` → WP (Couche 2)

Ces redirections sont déclarées dans `public/_redirects` (Cloudflare Pages) et retirées à mesure que les Couches 2 et 3 livrent leurs routes.

### 2.4 Contraintes globales

- **Langue du site** : français (fr-FR). Tous les libellés UI en français.
- **URLs préservées** : slugs WordPress conservés à l'identique (`/livre-audio-gratuit-mp3/<slug>.html`). Redirections 301 pour les divergences historiques.
- **Zéro régression SEO** : canonical, meta description, OpenGraph, titre identiques à WP pour chaque page migrée. Sitemap XML couvrant 100 % des pages.
- **Budget performance** (bloquant en CI) : LCP < 1 s, TBT < 200 ms, CLS < 0,05, JS total < 30 Ko (gzip) sur home et fiche livre.
- **Accessibilité** : WCAG 2.1 AA. Pas de `maximum-scale=1`. Focus visible, navigation clavier, `aria` complet sur le lecteur.
- **Polices** : système uniquement (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`). Aucune webfont externe.
- **Images** : AVIF + WebP + fallback JPG via Cloudflare Images, `loading="lazy"` natif (sauf LCP `fetchpriority="high"`), `sizes` adapté au layout réel, `width`/`height` systématiques (anti-CLS).
- **RGPD** : analytics anonymisés via Plausible (RGPD-compliant sans consent banner). Remplace GA4.
- **Licence** : contenu libre de droits ; code de la refonte sous MIT.

## 3. Modèle de données

### 3.1 Schéma PostgreSQL (Drizzle)

Tables concernées par la Couche 1 :

```sql
-- Livres
books(
  id              int pk,
  slug            text unique,
  title           text not null,
  excerpt         text default '',
  content         text default '',         -- description HTML rendue
  cover_url       text,
  cover_width     int,
  cover_height    int,
  cover_alt       text,
  duration_total  int not null,            -- somme des tracks, en secondes
  views           int default 0,           -- incrémenté via API /api/views/:id
  published_at    timestamptz not null,
  modified_at     timestamptz not null,
  legacy_url       text                    -- URL WP pour canonical 301 si besoin
)

-- Pistes audio (1 livre → N pistes)
tracks(
  id              int pk,
  book_id         int fk→books on delete cascade,
  order_index     int not null,
  title           text not null,
  url             text not null,
  duration        int default 0,           -- secondes
  size_bytes      int default 0,
  slug            text,
  download_count  int default 0
)

-- Taxonomies
authors(
  id, slug unique, name not null, description default '',
  letter char(1) not null,                 -- première lettre majuscule pour index alpha
  book_count int default 0
)
voices(
  id, slug unique, name not null, description default '',
  photo_url text,
  letter char(1) not null,
  book_count int default 0
)
genres(
  id, slug unique, name not null, description default '',
  book_count int default 0
)
periods(id, slug unique, name not null)
regions(id, slug unique, name not null)
licenses(id, slug unique, name not null)

-- Tables de jointure N:N
book_authors(book_id fk→books, author_id fk→authors, pk(book_id, author_id))
book_voices(book_id fk→books, voice_id fk→voices, pk(book_id, voice_id))
book_genres(book_id fk→books, genre_id fk→genres, pk(book_id, genre_id))

-- Métadata 1:1 livre
book_meta(
  book_id fk→books unique,
  period_id fk→periods,
  region_id fk→regions,
  license_id fk→licenses
)
```

### 3.2 Index

- `books(published_at desc)` — feed Nouveautés
- `books(views desc)` — feed Les plus aimés
- `tracks(book_id, order_index)` — liste ordonnée des pistes
- `books(title) USING gin (gin_trgm_ops)` — recherche full-text
- `books(excerpt) USING gin (gin_trgm_ops)` — recherche dans l'extrait
- `authors(letter)` / `voices(letter)` — index alphabétique
- `book_authors(author_id)` / `book_voices(voice_id)` / `book_genres(genre_id)` — requêtes inverses par taxonomie

Extension Postgres requise : `pg_trgm` (activation dans la première migration Drizzle).

### 3.3 Content Collections Astro (Zod)

Miroir typé pour le rendu SSG, hydraté depuis Postgres par `scripts/fetch-content.ts` au build.

```typescript
// src/content/config.ts (extrait — implémentation complète dans le plan)
const books = defineCollection({
  type: "data",
  schema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
    title: z.string(),
    excerpt: z.string().default(""),
    content: z.string().default(""),
    cover: z.object({
      url: z.string().url(), width: z.number().int().positive(),
      height: z.number().int().positive(), alt: z.string().default(""),
    }).optional(),
    durationTotal: z.number().int().nonnegative(),
    authors: z.array(TermRef),   // TermRef = { id, slug, name }
    voices: z.array(TermRef),
    genres: z.array(TermRef),
    period: TermRef.optional(),
    region: TermRef.optional(),
    license: TermRef.optional(),
    tracks: z.array(z.object({
      id: z.number(), slug: z.string(), title: z.string(),
      order: z.number(), url: z.string().url(),
      duration: z.number().int().nonnegative(), size: z.number().int().nonnegative(),
      downloadCount: z.number().int().nonnegative().default(0),
    })),
    views: z.number().int().nonnegative().default(0),
    publishedAt: z.coerce.date(),
    modifiedAt: z.coerce.date(),
    legacyUrl: z.string().url(),
  }),
});

const authors = defineCollection({
  type: "data",
  schema: z.object({
    id: z.number().int().positive(), slug: z.string(), name: z.string(),
    description: z.string().default(""), bookCount: z.number().int().nonnegative().default(0),
    letter: z.string().length(1),
  }),
});
// voices et genres : formes identiques (voices ajoute photoUrl optionnelle).
```

Les fichiers `src/content/{books,authors,voices,genres}/*.json` sont générés au build, **non commités** (`.gitignore`).

### 3.4 Recherche

Pendant la Couche 1, l'endpoint `/api/search` interroge directement Postgres via `pg_trgm` + `tsvector` sur `books.title` et `books.excerpt`. Seuil de pertinence configurable (par défaut 0,3). Si les tests de charge en Couche 2 révèlent une latence > 200 ms au 95e percentile, bifurcation vers Meilisearch ou Typesense (décision reportée à la Couche 2).

### 3.5 Migration one-shot WP → Postgres

Script : `scripts/migrate-wp-to-pg.ts` (exécuté manuellement au cutover).

1. Lecture paginée de `/wp-json/wp/v2/posts?per_page=100&_embed` (via le Cloudflare Worker de cache pour tolérer les lenteurs WP).
2. Pour chaque post : insertion `books` + résolution des terms (auteur/voix/genre) via `/wp-json/wp/v2/<taxonomy>`.
3. Pour chaque post : lecture de `/wp-json/wp/v2/media?parent=<id>` → insertion `tracks`.
4. Insertion des taxonomies via `INSERT ... ON CONFLICT (slug) DO UPDATE` (idempotent).
5. Transaction globale Postgres, rollback automatique si une étape échoue.
6. Mode `--dry-run` obligatoire avant cutover réel : écrit un rapport de cohérence (comptes attendus vs comptes obtenus) sans persister.
7. Vérification post-migration : `COUNT(*) books`, `COUNT(*) tracks`, `COUNT(*) authors`, `COUNT(*) voices` = valeurs attendues du rapport dry-run.

## 4. API custom & islands

### 4.1 API REST (Fastify ou Hono, déployée sur Fly.io)

Endpoints concernés par la Couche 1 :

| Méthode | Route | Rôle | Auth | Rate-limit |
|---|---|---|---|---|
| `GET` | `/api/search?q=&page=&genre=&auteur=&voix=&periode=` | Recherche full-text + facettes, paginée (20/page) | public | 10 req/s/IP |
| `GET` | `/api/books/:slug` | Fiche livre JSON (prévisualisation admin, hydratation SPA) | public | 10 req/s/IP |
| `GET` | `/api/authors/:slug/books?page=` | Livres d'un auteur, paginés | public | 10 req/s/IP |
| `GET` | `/api/voices/:slug/books?page=` | Livres d'un donneur de voix, paginés | public | 10 req/s/IP |
| `GET` | `/api/genres/:slug/books?page=` | Livres d'un genre, paginés | public | 10 req/s/IP |
| `POST` | `/api/views/:bookId` | Incrémente le compteur de vues (debouncé côté client) | public | 1 req/s/IP |
| `GET` | `/health` | Probe Fly.io | public | aucune |

Endpoints exclus de la Couche 1 (Couche 2/3) : auth, upload, contribution, forums, favoris — non exposés tant que leur spec n'est pas livré.

### 4.2 Sécurité API

- Validation Zod de tous les query params et bodies.
- CORS restreint au domaine public (`https://www.litteratureaudio.com`) + preview Cloudflare Pages.
- Aucun cookie sur les endpoints publics.
- Headers sur les GET : `Cache-Control: public, max-age=60, stale-while-revalidate=600`.
- Headers de sécurité : `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: default-src 'self'`.
- Rate-limit via `@fastify/rate-limit` (ou équivalent Hono) — 429 après dépassement.

### 4.3 Island `<Player/>` (fiche livre, `client:visible`)

- `<audio>` HTML5 natif (pas de bibliothèque tierce) — lecture séquentielle automatique des pistes.
- État : `currentTrack`, `isPlaying`, `currentTime`, `playbackRate`, `volume`.
- `localStorage` : mémorise `la:progress:<bookId>:<trackId>` en secondes entières → reprend à la même position à la reprise (même navigateur).
- Contrôles : play/pause, skip ±15 s, piste précédente/suivante, vitesse 0,75x/1x/1,25x/1,5x/2x, téléchargement de la piste courante (`<a download>`).
- `aria` complet : `role="region"` sur le conteneur, `aria-label` sur chaque bouton, live region `aria-live="polite"` annonçant "Piste 3 sur 12".
- Gestion d'erreur piste 404 : message "Piste indisponible, passage à la suivante" + auto-skip, pas de crash de l'island.
- Budget : < 8 Ko gzip (vanilla, aucune dépendance audio).

### 4.4 Island `<SearchBox/>` (header, `client:idle`)

- `<input type="search">` + dropdown résultats live, debounce 200 ms, 6 résultats max.
- Appel `GET /api/search?q=<query>&page=1` → rendu titre + auteur + cover 32×32.
- Navigation clavier : flèche haut/bas pour parcourir, Entrée pour aller à `/recherche?q=<query>` ou vers la fiche du résultat survolé, Échap pour fermer.
- Fallback si API down : "Recherche temporairement indisponible" + soumission du formulaire vers `/recherche?q=<query>` classique.
- Budget : < 4 Ko gzip.

### 4.5 Island `<ThemeToggle/>` (`client:idle`)

- Bouton basculant `class="dark"` sur `<html>`, persistance `localStorage` clé `la:theme`.
- Respecte `prefers-color-scheme` à la première visite.
- Budget : < 1 Ko gzip.

## 5. Build, CI/CD, hébergement, observabilité

### 5.1 Build Astro (10 000 pages SSG)

- `pnpm fetch:content` → `scripts/fetch-content.ts` interroge l'API (WP pendant la transition, Postgres après cutover) → écrit `src/content/{books,authors,voices,genres}/*.json` (non commités).
- `pnpm build` → `astro build` parallélisé (`build.concurrency` ajusté selon le runner). 10 000 pages en ~3–5 min sur runner GitHub Actions.
- **Rebuild incrémental** : `astro build` ne rebuild que les pages dont le contenu a changé (hash du JSON → skip si identique). Webhook WP `save_post` → GitHub `repository_dispatch` → workflow `rebuild-single.yml` ne mettant à jour que la fiche concernée + le sitemap.

### 5.2 Pipeline CI/CD (GitHub Actions)

| Workflow | Déclencheur | Étapes |
|---|---|---|
| `ci.yml` | PR | `pnpm install` → `biome check` → `vitest run` → `astro check` → `astro build` (smoke, pas de deploy) → Lighthouse CI (budgets bloquants) |
| `deploy-public.yml` | push `main` | build → `wrangler pages deploy dist` → vérification post-deploy (`curl` `/health` + 1 fiche) |
| `rebuild-single.yml` | `repository_dispatch` (webhook WP) | ne rebuild que la fiche modifiée + sitemap, upload incrémental Cloudflare Pages |
| `migrate.yml` | manuel (workflow_dispatch) | `tsx scripts/migrate-wp-to-pg.ts --dry-run` par défaut ; `--apply` pour cutover |

Budgets Lighthouse CI bloquants :
- Home : LCP < 1 s, TBT < 200 ms, CLS < 0,05, JS < 30 Ko, Performance ≥ 95, a11y ≥ 90.
- Fiche livre : idem + LCP image cover < 800 ms.
- Échec d'un budget = build en échec, pas de deploy.

### 5.3 Hébergement

| Composant | Plateforme | Détail |
|---|---|---|
| Front public | Cloudflare Pages | Gratuit, CDN global, HTTP/3, compression brotli automatique |
| API + admin (Couche 2/3) | Fly.io | Région Paris, auto-scaling `fly scale count 2`, container Node 20 |
| Postgres | Neon | Serverless, branches par environnement (`main`, `preview`, `migrate`) |
| Images | Cloudflare Images | AVIF/WebP à la volée, `cdn-cgi/imagedelivery/` |
| DNS | Cloudflare | Déjà en place pour le site actuel |

### 5.4 Observabilité

| Aspect | Outil | Détail |
|---|---|---|
| Erreurs API | Sentry | DSN en secret GitHub, sampling 10 % en prod |
| Métriques API | `/metrics` Prometheus → Grafana Cloud | Gratuit 50 Go |
| Perf front | Lighthouse CI + check hebdo `@lhci/cli` | Sur home + 1 fiche sample |
| Uptime | BetterStack ou UptimeRobot | Ping `/health` toutes les 60 s |
| Analytics public | Plausible | RGPD-compliant, pas de consent banner, remplace GA4 |

### 5.5 Rollback

- Front public : Cloudflare Pages garde les N derniers deploys ; rollback en 1 clic via dashboard ou `wrangler pages deployment rollback`.
- API : Fly.io `fly deploy --strategy canary` + `fly rollback` si régression.

## 6. Gestion d'erreur

- **Build** : si `fetch:content` échoue (API WP down ou 5xx), le build échoue en CI (fail-fast) ; pas de deploy d'un site incomplet. Alerte Slack via le workflow GitHub Actions.
- **Runtime API** : 404 livre → JSON `{error: "not_found"}` + statut 404 ; 500 → Sentry capture + réponse `{error: "internal"}` sans détail. Timeouts fetch à 5 s.
- **Runtime front (statique)** : pas d'erreur runtime possible (HTML pré-rendu). 404 native Astro pour slugs inexistants. Liens morts internes détectés par `astro:check` + `lychee` (link checker) en CI.
- **Migration** : transaction Postgres globale, rollback automatique si une étape échoue. Mode `--dry-run` obligatoire avant cutover réel. Vérification post-migration : `COUNT(*) books/tracks/authors/voices` = attendus.
- **Player** : piste audio injoignable (404 sur le MP3) → message "Piste indisponible, passage à la suivante" + auto-skip. Pas de crash de l'island.
- **Recherche** : API down → `<SearchBox>` affiche "Recherche temporairement indisponible" et fallback vers `/recherche?q=...` (qui elle-même retry).

## 7. Stratégie de tests

### 7.1 Unitaires (Vitest)

- `lib/format-duration.ts`, `lib/image-url.ts`, `lib/matchRoute`, `lib/makeCacheKey`.
- Schémas Zod (Content Collections) : validations acceptées + refus (cas limites : slug vide, duration négative, URL invalide).
- Normalisation slug, helpers de tri.
- Couverture > 80 % sur `lib/`.

### 7.2 Composants Astro

`@testing-library/dom` sur `BookCard.astro`, `Picture.astro`, `Header.astro`, `Footer.astro` :
- Rendu HTML correct (présence des attributs `alt`, `sizes`, `loading`, `fetchpriority`).
- Liens href corrects (slug préservé).
- Classes Tailwind attendues.

### 7.3 Islands React

Testing Library + `vi.mock` des calls API :
- `Player` : simulation `audio.play()` via mock de `HTMLAudioElement`. Tests : play/pause, skip ±15 s, changement piste auto à la fin, persistance localStorage, gestion 404 piste.
- `SearchBox` : debounce 200 ms, affichage 6 résultats, navigation clavier (haut/bas/Entrée/Échap), fallback API down.
- `ThemeToggle` : bascule `class="dark"`, persistance, respect `prefers-color-scheme`.

### 7.4 API

`supertest` sur Fastify/Hono. Pour chaque endpoint :
- Cas nominal (200 + payload correct).
- 404 (slug inexistant).
- 400 (validation Zod : params invalides, page négative, q vide).
- 429 (dépassement rate-limit).
- Données de test via fixture Postgres (`testcontainers` : un Postgres éphémère par suite).

### 7.5 E2E (Playwright)

Parcours critiques, lancés en CI sur un preview deploy Cloudflare Pages :
1. Home → clic fiche → lecteur démarre la lecture.
2. Recherche "zola" dans `<SearchBox>` → 1 résultat cliquable → atterrit sur la fiche.
3. Navigation clavier dans le header (Tab, Entrée).
4. Mode sombre activé → rechargement → mode sombre persisté.
5. 404 sur URL inexistante → page d'erreur Astro.

### 7.6 Performance (Lighthouse CI)

Budgets bloquants en CI :
- Home : LCP < 1 s, TBT < 200 ms, CLS < 0,05, JS < 30 Ko, Performance ≥ 95, a11y ≥ 90.
- Fiche livre : idem + LCP image cover < 800 ms.
- Échec d'un budget = build en échec, non déployé.

### 7.7 Link check

`lychee` sur `dist/` à chaque build. Seuil : 0 lien mort interne. Les liens externes (`wp-content/uploads/*` MP3, images) sont vérifiés mais non bloquants (warning uniquement).

### 7.8 SEO

- `astro check` systématique en CI.
- Test de non-régression SEO : avant cutover, diff des meta (title/description/canonical/OG/JSON-LD) entre WP et le nouveau front sur un échantillon de 50 fiches tirées au hasard. Toute divergence bloque le cutover.

## 8. Définition de fini (Couche 1)

1. Home, fiches livre, classements (auteur/voix/genre), recherche fonctionnels et rendus en SSG.
2. Lecteur audio opérationnel : play/pause, skip ±15 s, vitesse, reprise via localStorage, téléchargement piste.
3. URLs préservées (slugs WP) ; 301 pour les divergences ; sitemap couvre 100 % des pages.
4. Budgets perf Lighthouse tenus en CI : LCP < 1 s, TBT < 200 ms, CLS < 0,05, JS < 30 Ko.
5. WCAG 2.1 AA : zoom activé (pas de `maximum-scale=1`), focus visible, lecteur `aria` complet, navigation clavier testée.
6. Migration one-shot documentée + testée en `--dry-run` sur une branche Neon `migrate`.
7. Tests unitaires, composants, API, E2E verts en CI.
8. Monitoring opérationnel : Sentry, Plausible, uptime, Lighthouse hebdo.
9. Rollback testé (Cloudflare Pages + Fly.io).
10. Cutover : front public bascule sur `www.litteratureaudio.com`, WP reste accessible sur `admin.litteratureaudio.com` pour les Couches 2/3.

## Références

- `docs/wordpress-optimizations.md` — cahier des charges Phase 0 (quick wins WP transitoires).
- `docs/superpowers/plans/2026-07-19-refonte-litteratureaudio-foundation.md` — plan précédent (Astro + Cloudflare Worker, WP conservé comme back-office permanent). Le présent spec diverge : WP est remplacé totalement, à terme.

## Historique des révisions

| Rev | Date | Description | Auteur | Approbateur |
|---|---|---|---|---|
| 1 | 2026-07-28 | Création. Cadrage brainstorming : remplacement total WP, 3 couches incrémentales, Astro 5 + React/Vite, Postgres+Drizzle, Cloudflare Pages + Fly.io, migration one-shot. Couche 1 uniquement. | Refonte litteratureaudio.com | Utilisateur |