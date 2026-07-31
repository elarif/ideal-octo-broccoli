# Fiche livre — Métadonnées manquantes (V2)

> Design pour enrichir la fiche livre avec narrateur, date d'ajout, vues réelles, likes et licence.

## Document Metadata

| Champ | Valeur |
|---|---|
| Date | 2026-07-31 |
| Auteur | OpenCode |
| Cible | https://www.litteratureaudio.com |
| Approche validée | Récupérer `post-count-all` et `like_count` depuis l'API WP, afficher sur la fiche |

---

## 1. Objectif

Enrichir la fiche livre avec les métadonnées manquantes par rapport au site original : date d'ajout, vues réelles, likes. Le narrateur et la licence sont déjà affichés mais à valider.

## 2. Données à récupérer

| Métadonnée | Source API WP | Champ JSON |
|---|---|---|
| Vues | `post.meta["post-count-all"]` (int) | `views` |
| Likes | `post.meta.like_count` (int) | `likeCount` (nouveau) |
| Date d'ajout | `post.date_gmt` (déjà stocké dans `publishedAt`) | inchangé |
| Narrateur | `voices[]` (déjà stocké) | inchangé |
| Licence | `licences[]` (déjà stocké) | inchangé |

## 3. Changements

### 3.1 wp-client.ts

Ajouter au type `meta` de `WpPost` :
- `"post-count-all"?: number`
- `like_count?: number`

### 3.2 fetch-content.ts

Mapper les nouveaux champs :
- `views: post.meta?.["post-count-all"] ?? 0`
- `likeCount: post.meta?.like_count ?? 0`

### 3.3 content/config.ts

Ajouter au schéma `books` :
- `likeCount: z.number().int().nonnegative().default(0)`

### 3.4 Fiche livre [slug].astro

Afficher après "Durée" et avant "Genre" :
- `Ajouté le : 30 juillet 2026` (format `Intl.DateTimeFormat("fr-FR", {day:"numeric", month:"long", year:"numeric"})`)
- `244 écoutes` (si `views > 0`)
- `2 j'aime` (si `likeCount > 0`)

### 3.5 BookCard.astro

Aucun changement — le badge vues existant s'affichera automatiquement quand `views > 0`.

## 4. Critères de succès

- [ ] La fiche livre affiche "Ajouté le : [date]" au format français
- [ ] La fiche livre affiche "N écoutes" quand `views > 0`
- [ ] La fiche livre affiche "N j'aime" quand `likeCount > 0`
- [ ] Le badge vues apparaît sur les cartes quand `views > 0`
- [ ] `astro check` passe sans erreur
- [ ] Le build réussit