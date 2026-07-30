# Litteratureaudio.com — Clone fidèle V1

> Design pour enrichir le MVP V0 Astro statique avec lecteur audio, look & feel original, navigation par taxonomies et SEO complet.

## Document Metadata

| Champ | Valeur |
|---|---|
| Date | 2026-07-29 |
| Auteur | OpenCode |
| Audience | Équipe de développement / agents d'implémentation |
| Cible | https://www.litteratureaudio.com |
| Approche validée | Astro statique + React islands (Approche 1), Worker vues en option différée (Approche 2) |

---

## 1. Objectif et périmètre

### 1.1 Objectif

Transformer le MVP V0 en un **clone statique fidèle** du site Litteratureaudio.com, en respectant l'ordre de priorité :

1. **Expérience d'écoute** (player audio inline + global sticky).
2. **Look & feel** (header, sidebar, cartes, fiches, thème clair).
3. **Navigation et SEO** (pages par taxonomie, recherche, flux RSS, métadonnées).

### 1.2 Contraintes conservées

- Déploiement sur **Cloudflare Pages** (gratuit).
- Build statique Astro (`output: "static"`).
- Source de vérité : API REST publique WordPress.
- TypeScript strict, Tailwind CSS.

### 1.3 Hors scope V1

- Authentification / inscription / profil.
- Favoris et listes personnelles.
- Commentaires et forums.
- Espace contributeur / upload / workflow de création.
- Newsletter fonctionnelle.
- Dark mode / switch de couleur.
- Google Analytics (configurable, mais non bloquant).
- oEmbed / embed externe.
- Calendrier des publications.

### 1.4 Option V2+

- Cloudflare Worker pour compteur de vues, favoris et recherche serveur.

---

## 2. Architecture

### 2.1 Stack

- **Astro 4** avec `@astrojs/react` pour les islands interactives.
- **React 18** pour le player audio et la recherche.
- **lucide-react** pour les icônes.
- **Tailwind CSS 3** pour le style.
- **Zod** pour les schemas de content collections.

### 2.2 Data flow

```
API WP REST
    │
    ▼
fetch-content.ts  ──►  src/content/{books,authors,voices,genres,periods,regions,licences,tags}
    │
    ▼
Astro collections  ──►  getStaticPaths()  ──►  pages HTML statiques
    │
    ▼
React islands  ──►  player audio, recherche client
```

### 2.3 Collections de contenu

| Collection | Source WP | Utilisation |
|---|---|---|
| `books` | `/wp/v2/posts?_embed=1` | Fiches livre, home, listes |
| `authors` | `/wp/v2/auteur` | Pages auteur, liens fiche |
| `voices` | `/wp/v2/voix` | Pages voix, liens fiche |
| `genres` | `/wp/v2/genre_livre` | Pages genre, bibliothèque |
| `periods` | `/wp/v2/periode` | Pages période, liens fiche |
| `regions` | `/wp/v2/region` | Pages région, liens fiche |
| `licences` | `/wp/v2/licence` | Pages licence, liens fiche |
| `tags` | `/wp/v2/tags` | Pages tag |

Chaque entrée de taxonomie contient : `id`, `slug`, `name`, `count` (nombre de livres associés), `description` (optionnel).

---

## 3. Player audio

### 3.1 Composants React

| Composant | Responsabilité |
|---|---|
| `AudioProvider` | Contexte global : playlist, piste active, lecture/pause, position, volume. |
| `GlobalPlayer` | Barre sticky en bas de page, visible dès qu'une piste est lancée. |
| `TrackList` | Liste des pistes sur la fiche livre, avec Play par piste et "Lire tout". |
| `PlayButton` | Bouton Play sur les cartes (home et listes) et dans la tracklist. |

### 3.2 Comportements

- Clique sur une **carte livre** → lance la première piste du livre, affiche le player global.
- Clique sur une **piste** dans la fiche → joue cette piste.
- Player global : titre du livre, auteur, boutons précédent/suivant, play/pause, barre de progression, volume, bouton fermer.
- Navigation entre pages Astro : le player global **doit survivre** car il est monté comme island dans le layout `Base.astro`.
- Sources audio : URLs directes `tracks.url` (MP3 hébergés sur le site original ou externe).

### 3.3 Limites V1

- Pas de compteur de vues incrémenté en temps réel.
- Pas de reprise de lecture côté serveur (utilisation de `localStorage` optionnelle).
- Pas de waveform.

---

## 4. Look & feel

### 4.1 Header

- Logo texte "Litteratureaudio.com" à gauche.
- Barre de recherche centrée avec paramètre `?search_query=...` (compatibilité URL originale).
- Icônes à droite : connexion (placeholder), favoris (placeholder), bouton menu mobile.

### 4.2 Sidebar

- Menu latéral gauche, groupé comme l'original :
  - **Livres audio** : total, Les plus aimés, Nouveautés, Par genre, Par auteur, Par donneur de voix, Recherche avancée.
  - **Communauté** : Derniers commentaires (placeholder), Livre d'or (placeholder), Forums (placeholder), Notre association, Nous aider.
  - **Espace Perso** : Profil (placeholder), Favoris (placeholder).
- Version mobile : off-canvas via hamburger.

### 4.3 Cartes de livre (`BookCard`)

- Couverture avec ratio conservé, `loading="lazy"`.
- Badge durée en haut à droite.
- Badge vues (valeur statique/estimée, format `141` / `1.1K`).
- Boutons Play et "plus d'options" (placeholder).
- Titre, auteur(s).

### 4.4 Fiche livre

- Header : couverture + métadonnées.
- Liens cliquables : auteur(s), voix, genre, période, région, licence.
- Section lecteur / liste de pistes.
- Section description (contenu WP).

### 4.5 Footer

- Crédits association.
- Lien "Nous aider" simplifié.

### 4.6 Thème

- Couleur primaire `#466cde`.
- Fond clair par défaut.
- Polices système.

---

## 5. Navigation et pages de liste

### 5.1 Pages par taxonomie

| Page | Pattern d'URL |
|---|---|
| Auteur | `/livre-audio-gratuit-mp3/auteur/[slug].html` |
| Voix | `/livre-audio-gratuit-mp3/voix/[slug].html` |
| Genre | `/livre-audio-gratuit-mp3/genre/[slug].html` |
| Période | `/livre-audio-gratuit-mp3/periode/[slug].html` |
| Région | `/livre-audio-gratuit-mp3/region/[slug].html` |
| Licence | `/livre-audio-gratuit-mp3/licence/[slug].html` |
| Tag | `/livre-audio-gratuit-mp3/tag/[slug].html` |

### 5.2 Pages de classement spéciales

| Page | Contenu |
|---|---|
| `/classement-de-nos-livres-audio-gratuits-les-plus-apprecies` | Livres triés par vues décroissantes |
| `/nos-derniers-livres-audio-gratuits` | Livres triés par date décroissante |
| `/notre-bibliotheque-de-livres-audio-gratuits` | Mise en avant par genres |
| `/classement-de-nos-livres-audio-gratuits-par-auteur` | Index alphabétique des auteurs |
| `/classement-de-nos-livres-audio-gratuits-par-donneur-ou-donneuse-de-voix` | Index des voix |

### 5.3 Pagination

- 24 ou 48 livres par page.
- Composant `Pagination` avec liens `?page=N`.

### 5.4 Recherche

- Page `/recherche` (ou `/?s=...` pour compatibilité) avec composant React.
- Index client préchargé (JSON léger) contenant : titre, slug, auteurs, voix, genres.
- Filtrage instantané côté client.

---

## 6. SEO et métadonnées

### 6.1 Balises HTML

- `title` et `meta description` sur toutes les pages.
- Open Graph : `og:title`, `og:description`, `og:url`, `og:site_name`, `og:image`.
- Twitter Cards : `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:site`, `twitter:creator`.
- Canonical + shortlink.
- Favicon multi-tailles : 32x32, 180x180, 192x192, 270x270.
- `robots.txt` et sitemap.

### 6.2 Flux RSS

- `/feed.xml` : 50 derniers livres avec enclosures MP3.
- Format RSS 2.0 compatible iTunes/Podcast (titre, description, enclosure, durée).

### 6.3 Structured data

- Fiche livre : JSON-LD `BookAudio` / `CreativeWork` / `PodcastEpisode`.
- Pages de liste : `CollectionPage`.

### 6.4 Métadonnées à récupérer

- `views` : depuis les meta WP si disponible, sinon 0.
- `comment_count` : depuis `_bbp_topic_count` / `_bbp_reply_count` ou champ comments.
- `download_count` : si exposé par l'API.

---

## 7. Fichiers et structure

```
web/
├── src/
│   ├── content/
│   │   ├── config.ts
│   │   ├── books/
│   │   ├── authors/
│   │   ├── voices/
│   │   ├── genres/
│   │   ├── periods/
│   │   ├── regions/
│   │   ├── licences/
│   │   └── tags/
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Sidebar.astro
│   │   ├── Footer.astro
│   │   ├── BookCard.astro
│   │   ├── BookList.astro
│   │   ├── Pagination.astro
│   │   ├── SearchForm.astro
│   │   └── Player/
│   │       ├── AudioProvider.tsx
│   │       ├── GlobalPlayer.tsx
│   │       ├── TrackList.tsx
│   │       └── PlayButton.tsx
│   ├── hooks/
│   │   └── useAudioPlayer.ts
│   ├── layouts/
│   │   └── Base.astro
│   ├── lib/
│   │   ├── wp-client.ts
│   │   ├── fetch-taxonomies.ts
│   │   ├── format-duration.ts
│   │   ├── image-url.ts
│   │   ├── format-views.ts
│   │   └── env.ts
│   ├── pages/
│   │   ├── index.astro
│   │   ├── 404.astro
│   │   ├── robots.txt.ts
│   │   ├── feed.xml.ts
│   │   ├── recherche.astro
│   │   ├── nos-derniers-livres-audio-gratuits.astro
│   │   ├── classement-de-nos-livres-audio-gratuits-les-plus-apprecies.astro
│   │   ├── notre-bibliotheque-de-livres-audio-gratuits.astro
│   │   ├── classement-de-nos-livres-audio-gratuits-par-auteur.astro
│   │   ├── classement-de-nos-livres-audio-gratuits-par-donneur-ou-donneuse-de-voix.astro
│   │   ├── notre-association.astro
│   │   ├── nous-aider.astro
│   │   ├── livre-audio-gratuit-mp3/
│   │   │   └── [slug].astro
│   │   └── [taxo]/
│   │       ├── auteur/
│   │       │   └── [slug].astro
│   │       ├── voix/
│   │       │   └── [slug].astro
│   │       ├── genre/
│   │       │   └── [slug].astro
│   │       ├── periode/
│   │       │   └── [slug].astro
│   │       ├── region/
│   │       │   └── [slug].astro
│   │       ├── licence/
│   │       │   └── [slug].astro
│   │       └── tag/
│   │           └── [slug].astro
│   ├── scripts/
│   │   └── fetch-content.ts
│   └── styles/
│       └── global.css
├── public/
│   └── favicon*.png
├── astro.config.ts
└── package.json
```

---

## 8. Découpage en tâches

1. **Data layer** : étendre `fetch-content.ts` et `wp-client.ts` pour récupérer toutes les taxonomies et métadonnées.
2. **Player audio** : ajouter React islands (`AudioProvider`, `GlobalPlayer`, `TrackList`, `PlayButton`).
3. **UI fidèle** : refaire Header, Sidebar, Footer, BookCard, fiche livre.
4. **Pages de liste et recherche** : générer les pages par taxonomie et les pages de classement.
5. **SEO + flux** : Twitter Cards, favicons, RSS, JSON-LD.

---

## 9. Critères de succès

- [ ] Le player audio se lance depuis n'importe quelle carte ou piste et reste visible pendant la navigation.
- [ ] La sidebar et le header ressemblent visuellement au site original.
- [ ] Les liens auteur/voix/genre/période/région/licence sur une fiche mènent à une page de liste fonctionnelle.
- [ ] Les pages `/feed.xml` et `/sitemap-index.xml` sont générées.
- [ ] Le build Astro réussit avec l'ensemble du contenu (~10 000 livres).
- [ ] Le déploiement Cloudflare Pages fonctionne sans erreur.

---

## 10. Révision

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-07-29 | Design initial validé par l'utilisateur |
