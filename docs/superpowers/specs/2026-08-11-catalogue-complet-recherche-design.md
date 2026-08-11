# Spec: Catalogue complet (5000) + recherche avancée

| Field | Value |
|---|---|
| Document ID | `SPEC-CATALOG-SEARCH-A` |
| Revision | 1 |
| Effective Date | 2026-08-11 |
| Author | elarif |
| Approver | TBD |
| Status | draft |
| Decomposition | Spec A (this) — volume 5000 + recherche. Spec B (future) — reste du catalogue + raffinements. |

## Audience

Mainteneur du clone `litteratureaudio` (Astro 4 + Cloudflare Worker + Backblaze B2). Connaît le pipeline `fetch-content.ts` → Worker → D1 → JSON → pages statiques.

## Purpose / Scope

**Purpose** : Réduire l'écart entre le clone et `litteratureaudio.com` en montant le catalogue de ~500 à 5000 livres et en ajoutant une recherche avancée multi-critères + une recherche plein texte. Le site original propose ~10046 livres et un formulaire de recherche avancée (auteurs, genres, voix, périodes, régions, licences, durée). Le clone actuel se limite à 500 livres et une page de recherche placeholder.

**Scope covers** :
- Monter `FETCH_LIMIT` à 5000 et valider que le build tient la charge.
- Intégrer Pagefind (recherche plein texte) sur les pages livre.
- Générer un index JSON de filtres structurés (`search-filters.json`).
- Créer deux pages de recherche : `/recherche` (plein texte) et `/recherche-avancee` (filtres).
- Vérifier que les pages de taxonomies existantes paginent correctement à 5000 entrées.

**Scope does NOT cover** :
- Forums, livre d'or, commentaires réels, espace perso, contribution, donneurs de voix (specs futures).
- Monter au-delà de 5000 (Spec B).
- Backend, auth, upload (hors périmètre).
- Modifications du Worker ou de D1 (sauf si pagination réseau nécessaire).

## Definitions

| Term | Meaning |
|---|---|
| Pagefind | Outil d'indexation plein texte statique. Scanne le HTML généré, produit un index servi côté client. |
| Index JSON filtres | Fichier `search-filters.json` généré au build, consommé côté client pour la recherche multi-critères. |
| FETCH_LIMIT | Variable d'environnement contrôlant le nombre de livres récupérés au build (défaut 500). |
| Spec A | Premier incrément : 5000 livres + recherche. (Ce document.) |
| Spec B | Second incrément futur : reste du catalogue + raffinements. |

## Architecture

### Approche retenue

Tout statique. `FETCH_LIMIT=5000` au build. `astro build` génère ~5000 pages livre + pages taxonomies paginées. Pagefind scanne le HTML post-build. Index JSON filtres dérivé de la même collection. Aucune nouvelle infrastructure.

Rejeté : hybride statique+on-demand (complexité runtime Functions, dépendance D1) ; tout SSR Worker (coût runtime sur chaque page).

### Pipeline de build

1. `fetch-content.ts` (existant) — `FETCH_LIMIT=5000`. Récupère 5000 livres via Worker, écrit `src/content/books/*.json`.
2. `astro build` — génère pages statiques (livres, taxonomies, accueil, pages légales).
3. `pagefind --site dist` — indexe les pages livre (`data-pagefind-body`), produit `dist/pagefind/`.
4. `generate-search-index.ts` (nouveau) — lit `getCollection("books")` post-build, écrit `dist/search-filters.json`.

Ordre : `astro build` && `pagefind --site dist` && `tsx scripts/generate-search-index.ts`.

### Volume estimé

- Pages livre : 5000.
- Pages taxonomies : auteurs (~1500), voix (~500), genres (~50), périodes (~20), régions (~30), licences (~10), tags (~500). Pages de listing paginées : ~100-200.
- Pages légales + accueil + recherche : ~10.
- Assets Pagefind : ~200-500 fichiers d'index.
- Total : ~7000-8000 fichiers. Sous la limite Cloudflare Pages (20000).

## Composants

### 1. Indexation Pagefind (pages livre)

- `data-pagefind-body` sur l'élément `<article>` de `livre-audio-gratuit-mp3/[slug].astro:75`. Exclut taxonomies, pages légales, accueil.
- `data-pagefind-meta` sur métadonnées : `data-pagefind-meta="title"`, `data-pagefind-meta="author"`, `data-pagefind-meta="duration"`, `data-pagefind-meta="genre"`. Permet filtrage et affichage dans résultats.
- Poids : `data-pagefind-weight="2"` sur `<h1>` (titre) et noms d'auteurs. `data-pagefind-weight="1"` sur excerpt. `data-pagefind-weight="0.5"` sur description HTML. Pas de poids sur TrackList (noms de chapitres peu pertinents).
- Langue : `data-pagefind-language="fr"` sur `<html>` dans `Base.astro` (vérifier présence, ajouter si manquant).
- Script build : `npx pagefind --site dist` après `astro build`. Ajouté au `package.json` `web` et au workflow GitHub Actions.

### 2. Index JSON filtres (`search-filters.json`)

- Script : `web/scripts/generate-search-index.ts`. Lit `getCollection("books")` (ou parcourt `src/content/books/*.json` directement), écrit `dist/search-filters.json`.
- Structure (clés courtes pour minimiser taille) :
  ```json
  [{
    "s": "victor-hugo-ce-quon-entend-sur-la-montagne",
    "t": "Ce qu'on entend sur la montagne",
    "a": ["victor-hugo"],
    "v": ["harpo"],
    "g": ["poesie"],
    "p": ["19e-siecle"],
    "r": ["europe"],
    "l": ["domaine-public"],
    "d": 528,
    "w": 1000
  }]
  ```
  Champs : `s` (slug), `t` (title), `a` (authors slugs), `v` (voices slugs), `g` (genres slugs), `p` (periods slugs), `r` (regions slugs), `l` (licences slugs), `d` (durationTotal secondes), `w` (views). Pas de tags (trop volatils, ajoutent taille).
- Taille estimée : ~1-2 MB pour 5000 entrées. Compression Brotli automatique côté Cloudflare Pages.
- Build : `"postbuild": "tsx scripts/generate-search-index.ts"` dans `package.json`. Tourne après `astro build`.

### 3. Page `/recherche` (plein texte, Pagefind)

- Composant `SearchBox.tsx` (React, `client:idle`).
- Input texte, debounce 300ms. Import dynamique `import("/pagefind/pagefind.js")` au premier focus (chargement paresseux).
- Résultats inline : titre (lien vers page livre), excerpt tronqué, métadonnées (auteur, durée). 10 résultats/page, bouton "Charger plus".
- Empty state : "Recherchez parmi 5000+ livres audio gratuits".
- Lien vers `/recherche-avancee` : "Recherche par filtres →".
- Page Astro `recherche.astro` (existant, remplace placeholder actuel).

### 4. Page `/recherche-avancee` (filtres structurés)

- Composant `AdvancedSearch.tsx` (React, `client:idle`). Fetch `search-filters.json` au mount.
- Filtres : `<select multiple>` pour auteurs, voix, genres, périodes, régions, licences (options remplies dynamiquement depuis le JSON). `<input type="range">` durée (min-max dérivé du JSON). Bouton "Réinitialiser".
- Résultats : grille `BookCard` (réutilise composant existant). 20/page, pagination client.
- URL synchronisée : `?genres=poesie,roman&duree=120-600` pour partage/bookmark. Filtres lus au mount depuis query string.
- Lien vers `/recherche` : "Recherche plein texte →".
- Page Astro `recherche-avancee.astro` (nouvelle).

### 5. Navigation

- Menu header existant "Recherche avancée" → pointe sur `/recherche-avancee`.
- Ajouter entrée "Recherche" (plein texte) dans le menu, à côté de "Recherche avancée".

### 6. Taxonomies & pagination

- Vérifier `auteur/[slug].astro` et `voix/[slug].astro` paginent correctement (ajouter route `[slug]/[page].astro` si manquant, sur le modèle de `genre/[slug]/[page].astro`).
- Vérifier `classement-de-nos-livres-audio-gratuits-par-auteur.astro` et `classement-de-nos-livres-audio-gratuits-par-donneur-ou-donneuse-de-voix.astro` paginent ou virtualisent à 5000 entrées.
- `notre-bibliotheque-de-livres-audio-gratuits.astro` : vérifier pagination `[...page].astro` supporte 5000 livres.
- Pas de nouvelle feature. Corrections mineures si pagination cassée.

## Data Flow

```
Worker/D1 → fetch-content.ts (FETCH_LIMIT=5000) → src/content/books/*.json (5000)
                                                              |
                                                              v
                                                  astro build → dist/*.html (5000+)
                                                              |
                                                              +→ pagefind --site dist → dist/pagefind/
                                                              |
                                                              +→ generate-search-index.ts → dist/search-filters.json
```

Navigateur :
- `/recherche` → import paresseux `/pagefind/pagefind.js` → recherche plein texte.
- `/recherche-avancee` → fetch `search-filters.json` → filtrage client-side.

## Error Handling

- **Pagefind vide** : si `dist/pagefind/` absent, `/recherche` affiche "Index de recherche indisponible. Réessayez plus tard." Pas de crash.
- **search-filters.json indisponible** : `/recherche-avancee` affiche "Filtres indisponibles." Pas de crash. Fetch a timeout 5s.
- **Build timeout** : si `astro build` > 30 min, réduire `FETCH_LIMIT` temporairement, paralléliser `fetch-content.ts` (batch `Promise.all` de 10-20), ou ajouter cache Worker.
- **Limite fichiers Pages** : si > 20000, réduire `FETCH_LIMIT`. Surveillance au premier déploiement.

## Testing & Validation

- **Build local** : `FETCH_LIMIT=5000 pnpm --filter @la/web run build` avant push. Vérifier temps + taille `dist/` + nombre fichiers. Si > 20000, réduire.
- **Pagefind** : vérifier `dist/pagefind/` généré. Tester recherche manuelle (mots-clés français, accents, termes partiels).
- **search-filters.json** : vérifier taille < 3MB, structure valide (parse JSON, 5000 entrées).
- **Pages recherche** : `/recherche` et `/recherche-avancee` fonctionnelles. Filtres combinés renvoient résultats attendus. URL synchronisée marche (partager, recharger).
- **Taxonomies** : pages auteur/voix avec beaucoup de livres paginent correctement. Pas de page vide.
- **Régression** : lecteur audio, téléchargement, pages livre existantes toujours fonctionnels (pas de regression par volume).
- Pas de framework de test formel (projet statique). Validation manuelle + build local.

## Performance Build & Déploiement

- **Temps de build** : 5000 pages × génération HTML + fetch réseau (Worker). Risque timeout GitHub Actions (6h max, viser < 30 min).
  - `fetch-content.ts` : 5000 requêtes Worker séquentielles = lent. Paralléliser avec `Promise.all` batch de 10-20, ou paginer côté Worker (endpoint renvoie 100/page).
  - `astro build` : 5000 pages statiques. Astro gère bien, `getCollection("books")` chargé en mémoire à chaque page. Surveiller `--verbose` au premier build.
  - Pagefind post-build : ~30-60s pour 5000 pages. OK.
- **Limite Cloudflare Pages** : 20000 fichiers. 5000 livres + taxonomies paginées + assets + pagefind = ~7000-8000 fichiers. Marge OK.
- **GitHub Actions** : ajouter step Pagefind (`npx pagefind --site dist`) après `astro build` et avant `wrangler pages deploy`. Mesurer temps total, ajuster si > 30 min.
- **Cache Pages** : assets statiques cachés automatiquement. Pas de changement.

## Risques

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Build > 30 min | Moyenne | Déploiement retardé | Paralléliser fetch-content, réduire FETCH_LIMIT temporairement |
| > 20000 fichiers Pages | Faible | Build rejeté | Surveiller nombre, réduire FETCH_LIMIT |
| Pagefind index trop gros | Faible | Recherche lente | Pagefind gère bien 5000 pages, surveiller taille `dist/pagefind/` |
| search-filters.json > 3MB | Faible | Fetch lent | Compression Brotli automatique, clés courtes |
| Taxonomies cassées à 5000 | Moyenne | Pages vides/erreur | Valider pagination avant push |
| Régression lecteur audio | Faible | UX cassée | Tests manuels post-build |

## Out of Scope (explicite)

- Monter au-delà de 5000 livres (Spec B).
- Forums, livre d'or, commentaires réels, espace perso, contribution, donneurs de voix.
- Backend, auth, upload.
- Modifications du Worker ou de D1 (sauf pagination réseau si nécessaire).
- Refonte visuelle majeure. Les nouvelles pages de recherche suivent le design existant (Tailwind, composants `Section`, `BookCard`).

## Open Questions

| Question | Statut | Action si non résolu |
|---|---|---|
| `Base.astro` a-t-il déjà `lang="fr"` ? | À vérifier à l'implémentation | Ajouter `data-pagefind-language="fr"` |
| `auteur/[slug].astro` pagine-t-il déjà ? | À vérifier à l'implémentation | Ajouter route `[slug]/[page].astro` |
| `fetch-content.ts` parallélisable ? | À valider | Refactor en batch `Promise.all` |

## Revision History

| Rev | Date | Description | Author |
|---|---|---|---|
| 1 | 2026-08-11 | Initial draft. Spec A : 5000 livres + recherche Pagefind + JSON filtres. | elarif |