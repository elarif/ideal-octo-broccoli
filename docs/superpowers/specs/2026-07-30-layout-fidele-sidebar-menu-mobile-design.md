# Litteratureaudio.com — Layout fidèle, sidebar et menu mobile

> Design pour restructurer le clone afin de reproduire fidèlement le layout du site original : sidebar gauche fixe, header avec recherche, menu mobile off-canvas, cartes avec bouton Play accessible.

## Document Metadata

| Champ | Valeur |
|---|---|
| Date | 2026-07-30 |
| Auteur | OpenCode |
| Audience | Équipe de développement / agents d'implémentation |
| Cible | https://www.litteratureaudio.com |
| Approche validée | Reproduire la structure originale avec Tailwind, sans porter le thème waveme |

---

## 1. Objectif et périmètre

### 1.1 Objectif

Restructurer le clone pour reproduire fidèlement le layout du site Litteratureaudio.com : sidebar gauche fixe sur desktop, header avec logo et recherche, menu mobile off-canvas, cartes avec bouton Play accessible au tactile.

### 1.2 Décisions validées

- **Fidélité** : reproduire la structure originale (sidebar + header + contenu) avec Tailwind, sans porter le CSS du thème WordPress waveme.
- **Sidebar** : 3 groupes complets comme l'original ("Livres audio", "Communauté", "Espace Perso") avec liens désactivés marqués "Bientôt" pour les fonctionnalités non implémentées.
- **Bouton Play** : toujours visible (semi-transparent, devient opaque au hover/tap), accessible sur tactile.
- **Couvertures** : ratio fixe 3:4 portrait avec `object-fit: cover`, grille uniforme.

### 1.3 Hors scope

- Port du thème waveme (CSS/PHP).
- Dark mode.
- Recherche avancée avec filtres.
- Commentaires, forums, favoris fonctionnels.
- Images responsive avec srcset (task séparée).

---

## 2. Layout global

### 2.1 Structure

```
┌─────────┬──────────────────────────────┐
│         │ Header (logo + recherche)     │
│ Sidebar ├──────────────────────────────┤
│ fixe     │                               │
│ 256px    │  Contenu (grille cartes)       │
│          │                               │
│          │                               │
├─────────┴──────────────────────────────┤
│ Footer                                   │
└──────────────────────────────────────────┘
```

### 2.2 Desktop (≥768px)

- Sidebar : `w-64 sticky top-0 h-screen overflow-y-auto`, visible en permanence.
- Header : `sticky top-0 z-40 bg-white border-b`.
- Contenu : `flex-1 max-w-6xl mx-auto w-full p-4 pb-24`.
- Le `pb-24` laisse de la place au GlobalPlayer sticky.

### 2.3 Mobile (<768px)

- Sidebar : `fixed top-0 left-0 h-full w-64 z-50 transform -translate-x-full transition-transform duration-300`. Masquée par défaut.
- En `md:` redevient `static translate-x-0`.
- Overlay : `fixed inset-0 bg-black/50 z-40 md:hidden`, masqué par défaut.
- Body : `overflow-hidden` quand la sidebar est ouverte.

---

## 3. Sidebar

### 3.1 Structure

```
Litteratureaudio.com (logo texte, lien vers /)

LIVRES AUDIO
  Accueil (N)
  Les plus aimés
  Nouveautés
  Par genre
  Par auteur
  Par donneur de voix
  Recherche avancée

COMMUNAUTÉ
  Derniers commentaires — Bientôt
  Livre d'or — Bientôt
  Forums — Bientôt
  Notre association
  Nous aider

ESPACE PERSO
  Profil — Bientôt
  Favoris — Bientôt
```

### 3.2 Comportement

- N = nombre total de livres (dynamique, depuis `getCollection("books")`).
- Liens "Bientôt" : `<span class="text-gray-400">` + badge `Bientôt` discret, non cliquables.
- Liens actifs : `bg-gray-200 text-primary`.
- Logo texte en haut de sidebar, `text-primary font-semibold`, lien vers `/`.
- Scrollable si le contenu dépasse la hauteur écran (`overflow-y-auto`).

### 3.3 Mobile

- Sidebar off-canvas : `translateX(-100%)` par défaut, `translateX(0)` quand ouverte.
- Overlay `bg-black/50` derrière, clic ferme la sidebar.
- Bouton `✕` en haut de la sidebar mobile pour fermeture explicite.

---

## 4. Header

### 4.1 Structure

```
[☰]  Litteratureaudio.com    [Recherche........] [OK]    ♥ 👤
```

### 4.2 Desktop

- Logo `text-primary font-semibold` à gauche.
- Formulaire de recherche centré, `max-w-md`, `GET /recherche?q=...`.
- Icônes à droite : Favoris (♥), Connexion (👤), `text-gray-600 hover:text-primary`.

### 4.3 Mobile

- Bouton hamburger `☰` à gauche, `md:hidden`, ouvre la sidebar.
- Logo à côté du hamburger.
- Recherche masquée du header (accessible via sidebar → "Recherche avancée").
- Icônes (♥, 👤) à droite.

### 4.4 Recherche

- Paramètre URL `q` pré-remplit l'input de la page `/recherche`.
- Le formulaire du header envoie `GET /recherche?q=<valeur>`.

---

## 5. Cartes de livre (BookCard)

### 5.1 Structure

```
┌──────────────────┐
│   ┌────┐         │
│   │ ▶  │  12 min  │  ← bouton Play semi-transparent + badge durée
│   └────┘  1.1K 🎧 │  ← vues (si > 0)
│                  │
│   Couverture     │
│   (3:4 cover)    │
│                  │
├──────────────────┤
│ Titre du livre    │
│ Auteur, Auteur    │
└──────────────────┘
```

### 5.2 Image

- `aspect-[3/4] object-cover w-full`, `loading="lazy"`, `decoding="async"`.
- Ratio uniforme imposé par le conteneur.

### 5.3 Bouton Play

- `absolute top-2 left-2`, `bg-primary/80 text-white rounded-full p-2`.
- `opacity-60` par défaut, `opacity-100` au hover/tap.
- Toujours visible, accessible au tactile.
- Envoie `playBook` avec la première piste.
- `stopPropagation` sur le clic pour ne pas déclencher le lien de la carte.

### 5.4 Badges

- Badge durée : `absolute top-2 right-2`, `bg-black/70 text-white text-xs px-2 py-1 rounded`.
- Badge vues : `absolute bottom-2 right-2`, `bg-black/70 text-white text-xs`, `▶ {formatViews}`. Affiché seulement si `views > 0`.

### 5.5 Titre et auteur

- Sous l'image, `p-3`.
- Titre : `font-semibold leading-tight`.
- Auteur : `text-sm text-gray-700`.

### 5.6 Lien

- Toute la carte est cliquable vers la fiche livre, sauf le bouton Play qui `stopPropagation`.

---

## 6. Fiche livre

### 6.1 Structure

```
┌────────────┬─────────────────────────────┐
│            │ Titre du livre (h1)          │
│ Couverture │ De Auteur, Auteur            │
│ (3:4)      │ Lu par Voix                  │
│ max 300px  │ Durée : 11 h 4 min           │
│            │ Genre : Essais               │
│            │ Période : 20e siècle         │
│            │ Région : Autriche             │
│            │ Licence : CC BY-NC-SA         │
└────────────┴─────────────────────────────┘

Écouter / Télécharger
┌─────────────────────────────────────────┐
│ ▶  Chap. 01 – ...              12:30  ⬇  │
│ ▶  Chap. 02 – ...              15:00  ⬇  │
│ ▶  Chap. 03 – ...              10:45  ⬇  │
│   ...                                    │
└─────────────────────────────────────────┘

Description
  Contenu HTML du livre...
```

### 6.2 Header

- `flex` desktop (image gauche 1/3, métadonnées droite), `flex-col` mobile.
- Couverture : `max-w-xs rounded`.
- Liens auteurs/voix/genre cliquables vers les pages taxonomie.
- Période/région/licence en texte simple.

### 6.3 Liste des pistes

- Composant React `TrackList` existant.
- Chaque piste : bouton Play/Pause, titre, durée en `mm:ss` via `formatMediaTime`, lien de téléchargement MP3 (icône ⬇).
- La piste en cours est mise en évidence (`bg-gray-100`).

### 6.4 Description

- `prose max-w-none`, `set:html` du contenu WP.

### 6.5 Padding bas

- `pb-24` sur le `<main>` pour laisser de la place au GlobalPlayer sticky.

---

## 7. Menu mobile

### 7.1 Ouverture

- Bouton hamburger `☰` dans le header (`md:hidden`).
- Au clic : sidebar `translate-x-0`, overlay visible, body `overflow-hidden`.

### 7.2 Fermeture

- Clic sur l'overlay.
- Clic sur un lien dans la sidebar (navigation Astro).
- Bouton `✕` en haut de la sidebar mobile.

### 7.3 Implémentation

- Vanilla JS inline dans `Base.astro` (toggle simple, pas d'island React).
- Variables : `sidebar` (`<aside id="sidebar">`), `overlay` (`<div id="sidebar-overlay">`), `hamburger` (`<button id="menu-toggle">`).
- Fonction `toggleSidebar()` : ajoute/retire les classes, gère `overflow-hidden` sur body.

---

## 8. Fichiers impactés

### 8.1 Modifications

| Fichier | Changement |
|---|---|
| `web/src/layouts/Base.astro` | Restructurer en sidebar + header + contenu + footer, ajouter vanilla JS pour toggle mobile |
| `web/src/components/Header.astro` | Ajouter hamburger, repositionner logo et recherche |
| `web/src/components/Sidebar.astro` | Restructurer en 3 groupes avec "Bientôt", classes mobile off-canvas |
| `web/src/components/BookCard.astro` | Ratio 3:4, bouton Play toujours visible, badges repositionnés |
| `web/src/pages/livre-audio-gratuit-mp3/[slug].astro` | Layout header fiche + TrackList + liens cliquables |
| `web/src/components/Player/PlayButton.tsx` | `stopPropagation` sur le clic |
| `web/src/styles/global.css` | Primary color `#466cde`, transitions sidebar mobile |

### 8.2 Inchangés

- `GlobalPlayer.tsx`, `AudioProvider.tsx`, `TrackList.tsx` (déjà fonctionnels).
- Pages de liste, recherche, classements (utilisent BookList → BookCard automatiquement).
- SEO, RSS, favicons.

---

## 9. Critères de succès

- [ ] La sidebar est visible en permanence sur desktop (≥768px).
- [ ] Le menu hamburger ouvre/ferme la sidebar sur mobile (<768px).
- [ ] L'overlay sombre apparaît derrière la sidebar mobile.
- [ ] Le bouton Play est visible et cliquable sur tactile.
- [ ] Les cartes ont un ratio d'image uniforme 3:4.
- [ ] La fiche livre affiche la liste des pistes avec Play/Pause et téléchargement.
- [ ] Le layout global ressemble au site original (sidebar gauche + header + contenu).
- [ ] `astro check` passe sans erreur.
- [ ] Le build Astro réussit et le déploiement Cloudflare Pages fonctionne.

---

## 10. Révision

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-07-30 | Design initial validé par l'utilisateur |