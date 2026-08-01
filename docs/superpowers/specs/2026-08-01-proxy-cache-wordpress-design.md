# Proxy cache WordPress + stockage médias — Design

> Date : 2026-08-01
> Auteur : OpenCode
> Objectif : Protéger le site original `litteratureaudio.com` en créant un Worker proxy cache, une base de données relationnelle pour le catalogue, et un stockage objet bon marché pour les médias, le tout avec des scénarios de croissance chiffrés.

---

## 1. Contexte

Le clone actuel interroge directement l’API WordPress du site original (`https://www.litteratureaudio.com/wp-json/wp/v2/`) à chaque build. Avec `FETCH_LIMIT=3000` et ~300 auteurs, chaque build génère plusieurs milliers de requêtes. Cela :
- martèle le serveur original,
- ralentit considérablement le build GitHub Actions (15+ minutes),
- rend le catalogue complet (~10 000 livres) impraticable,
- sollicite le serveur original pour chaque lecture audio (MP3).

## 2. Objectif

Créer une **infrastructure de cache et de stockage** qui :
- s’intercale entre le clone et le site original via un Cloudflare Worker,
- stocke de façon pérenne les métadonnées du catalogue dans une base SQL (D1),
- met en cache les requêtes fréquentes en Cache API,
- stocke les médias (MP3, portraits, couvertures) dans Backblaze B2 servi via Cloudflare CDN,
- ne contacte le site original que lors d’une **synchronisation contrôlée**,
- reste gratuite ou peu coûteuse à tous les paliers de croissance envisagés.

## 3. Architecture globale

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GitHub Actions build                             │
│              (ne contacte JAMAIS WordPress directement)                  │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Cloudflare Worker                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Cache API  (L1)                                                  │   │
│  │ - réponses fréquentes JSON                                       │   │
│  │ - fiches livre                                                   │   │
│  │ - résultats de recherche                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                  │                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ D1  (catalogue relationnel)                                     │   │
│  │ - books, authors, voices, genres, periods, regions, licences     │   │
│  │ - tracks (URLs, durées, tailles)                                 │   │
│  │ - indexes pour recherche/listes                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                  │                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ KV  (état global)                                               │   │
│  │ - last_sync_at, sync_lock, stats                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
        Cloudflare R2       Backblaze B2        WordPress original
       (config/statiques)   (MP3, images)        (source initiale
                                                   uniquement lors
                                                   d’une sync)
```

---

## 4. Composants détaillés

### 4.1 Cloudflare D1 — Catalogue relationnel

D1 stocke toutes les métadonnées textuelles du catalogue.

**Schéma minimal :**

```sql
CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE,
  title TEXT,
  excerpt TEXT,
  content TEXT,
  cover_url TEXT,
  duration_total INTEGER,
  published_at TEXT,
  modified_at TEXT,
  legacy_url TEXT,
  views INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  download_url TEXT,
  text_url TEXT
);

CREATE TABLE authors (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT,
  description TEXT,
  count INTEGER,
  portrait_url TEXT,
  portrait_alt TEXT
);

CREATE TABLE voices (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, count INTEGER);
CREATE TABLE genres (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, count INTEGER);
CREATE TABLE periods (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, count INTEGER);
CREATE TABLE regions (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, count INTEGER);
CREATE TABLE licences (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, count INTEGER);

CREATE TABLE book_authors (book_id INTEGER, author_id INTEGER, PRIMARY KEY(book_id, author_id));
CREATE TABLE book_voices  (book_id INTEGER, voice_id INTEGER, PRIMARY KEY(book_id, voice_id));
CREATE TABLE book_genres  (book_id INTEGER, genre_id INTEGER, PRIMARY KEY(book_id, genre_id));
CREATE TABLE book_periods (book_id INTEGER, period_id INTEGER, PRIMARY KEY(book_id, period_id));
CREATE TABLE book_regions (book_id INTEGER, region_id INTEGER, PRIMARY KEY(book_id, region_id));
CREATE TABLE book_licences(book_id INTEGER, licence_id INTEGER, PRIMARY KEY(book_id, licence_id));

CREATE TABLE tracks (
  id INTEGER PRIMARY KEY,
  book_id INTEGER,
  slug TEXT,
  title TEXT,
  url TEXT,
  b2_url TEXT,
  duration INTEGER,
  size INTEGER,
  "order" INTEGER
);
```

### 4.2 Backblaze B2 — Stockage médias

Backblaze B2 est le stockage principal pour les médias :
- MP3 des pistes audio,
- portraits d’auteurs,
- couvertures de livres.

Les médias sont servis via un sous-domaine Cloudflare (ex. `media.litteratureaudio.pages.dev`) pour bénéficier de la bande passante gratuite via le partenariat Backblaze/Cloudflare.

### 4.3 Cloudflare Cache API — Cache L1

Cache d’accélération pour :
- les requêtes API fréquentes,
- les fiches livre générées,
- les résultats de recherche.

### 4.4 Cloudflare KV — État et configuration

Stockage minimal :
- `last_sync_at` : date de dernière synchronisation,
- `sync_lock` : verrou de sync,
- `stats` : nombre de livres, auteurs, pistes, taille B2.

### 4.5 Cloudflare Worker — Proxy et orchestrateur

Le Worker expose plusieurs endpoints :

| Endpoint | Rôle |
|---|---|
| `/wp/v2/*` | Proxy compatible API WordPress, lit D1 ou sync depuis l’original |
| `/api/books` | Recherche/liste paginée depuis D1 |
| `/api/book/:slug` | Fiche livre depuis D1 |
| `/media/*` | Sert un média B2 (MP3, image) avec fallback sur l’original |
| `/admin/sync` | Lance une sync contrôlée (protégée par secret) |
| `/admin/sync/mp3` | Sync batch de MP3 manquants vers B2 |

### 4.6 R2 (Cloudflare) — Fichiers statiques de configuration

Usage optionnel pour stocker de petits fichiers globaux (index de recherche, manifest de sync). B2 reste le choix principal pour les médias.

---

## 5. Stratégie de synchronisation

Le site original n’est contacté que lors d’une **synchronisation contrôlée**.

### Sync initiale

1. Endpoint `/admin/sync` avec secret.
2. Le Worker récupère tous les livres par pages de 100 depuis WordPress.
3. Pour chaque livre, récupère les stations/media (pistes).
4. Récupère les pages auteur pour extraire les portraits.
5. Insère/ met à jour D1.
6. Télécharge et stocke les portraits/couvertures dans B2.
7. Met à jour KV `last_sync_at`.

### Sync incrémentale

- `?since=<ISO_DATE>` pour ne récupérer que les livres modifiés après `last_sync_at`.
- Utile pour les mises à jour quotidiennes sans tout refaire.

### Sync MP3

- Endpoint `/admin/sync/mp3`.
- Récupère depuis D1 les pistes dont `b2_url` est NULL.
- Télécharge depuis WordPress et upload dans B2.
- Met à jour `tracks.b2_url`.
- Processus progressif : on peut sync par lots de 100 pistes pour éviter timeout.

---

## 6. Scénarios de croissance et coûts

Hypothèses de taille :
- JSON métadonnées par livre : ~10 Ko.
- Couverture moyenne : ~50 Ko.
- Portrait auteur : ~100 Ko.
- MP3 moyen par livre : 10 pistes × 10 Mo = 100 Mo (bitrate ~128 kbps).

| Palier | Livres | MP3 total | Stockage B2 | Coût B2/mois | Stockage D1 | D1 gratuit ? |
|---|---|---|---|---|---|---|
| 1 000 | ~100 Go | ~100 Go | 100 Go × 0,005 $ | **0,50 $** | ~10 Mo | ✅ |
| 5 000 | ~500 Go | ~500 Go | 500 Go × 0,005 $ | **2,50 $** | ~50 Mo | ✅ |
| 10 000 | ~1 To | ~1 To | 1 To × 0,005 $ | **5,00 $** | ~100 Mo | ✅ |
| 100 000 | ~10 To | ~10 To | 10 To × 0,005 $ | **50,00 $** | ~1 Go | ✅ |
| 500 000 | ~50 To | ~50 To | 50 To × 0,005 $ | **250,00 $** | ~5 Go | ✅ (limite) |
| 1 000 000 | ~100 To | ~100 To | 100 To × 0,005 $ | **500,00 $** | ~10 Go | ❌ dépasse 5 Go |

### Coûts Cloudflare gratuits

| Service | Quota gratuit | Suffisant jusqu’à |
|---|---|---|
| Workers | 100 000 requêtes/jour | ~100k livres si cache efficace |
| D1 | 5 Go, 100k requêtes/jour | ~500k livres |
| Cache API | illimité en pratique | tous paliers |
| KV | 1 Go, 100k lectures/jour | tous paliers |
| R2 (optionnel) | 10 Go | config/statiques |

### Bande passante

Backblaze B2 servi via Cloudflare CDN = **egress gratuit** dans le cadre du Bandwidth Alliance.
Bande passante Cloudflare Pages = **gratuite**.

### Synthèse coût par palier

| Palier | Coût total mensuel estimé | Commentaire |
|---|---|---|
| 1 000 livres | ~0,50 $ | Quasi gratuit |
| 5 000 livres | ~2,50 $ | Très abordable |
| 10 000 livres | ~5,00 $ | Objectif actuel du clone |
| 100 000 livres | ~50 $ | Catalogues massifs |
| 500 000 livres | ~250 $ + D1 payant | D1 dépasse 5 Go |
| 1 000 000 livres | ~500 $ + D1 payant + Workers payant | Nécessite plan payant Workers |

---

## 7. Phases d’implémentation

### Phase 1 — Worker + D1 + Cache API

- Créer le Worker.
- Déployer une base D1.
- Implémenter la sync complète et incrémentale.
- Faire lire `fetch-content.ts` via le Worker.
- Supprimer les requêtes directes vers WordPress dans le build.

### Phase 2 — Backblaze B2 pour les médias

- Créer un compte et un bucket B2.
- Configurer un sous-domaine Cloudflare pour servir B2.
- Implémenter `/admin/sync/mp3`.
- Modifier le lecteur audio pour utiliser les URLs B2 quand disponibles.
- Stocker les portraits et couvertures dans B2.

### Phase 3 — Optimisations et croissance

- Recherche full-text D1.
- Cache API affiné par type de requête.
- Sync automatique programmée (GitHub Actions schedule).
- Monitoring du cache hit/miss et de l’état B2.

---

## 8. Sécurité

- `/admin/*` protégé par un secret (`SYNC_SECRET`) stocké dans les variables Cloudflare.
- Le secret est aussi dans les secrets GitHub Actions pour les syncs programmées.
- Pas d’exposition des clés B2 côté client : le Worker génère des URLs signées si nécessaire, ou sert directement les médias via le domaine Cloudflare.

---

## 9. Critères de succès

- [ ] Site original non sollicité lors des builds Astro.
- [ ] Worker + D1 + Cache API fonctionnels.
- [ ] Sync complète d’au moins 3 000 livres réussie.
- [ ] Build GitHub Actions sous 5 minutes après sync initiale.
- [ ] Lecteur audio fonctionne avec les MP3 B2 (Phase 2).
- [ ] Coût mensuel inférieur à 10 $ pour le palier 10 000 livres.

---

## 10. Prochaines étapes

1. Valider ce spec.
2. Rédiger le plan d’implémentation de la Phase 1 (Worker + D1 + Cache API).
3. Exécuter le plan.
4. Tester la sync complète avec `FETCH_LIMIT=3000`, puis sans limite.
5. Passer à la Phase 2 (Backblaze B2) une fois la Phase 1 stable.
