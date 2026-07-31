# Page d'accueil fidèle au site original

> Design pour enrichir l'accueil du clone avec les éléments caractéristiques manquants : lien "Voir toutes les nouveautés", "Le Choix de Claryssandre", newsletter et section commentaires statique.

## Document Metadata

| Champ | Valeur |
|---|---|
| Date | 2026-07-31 |
| Auteur | OpenCode |
| Cible | https://www.litteratureaudio.com |

---

## 1. Objectif

Rapprocher la page d'accueil du clone de celle du site original en ajoutant les sections et liens visibles sur l'original, tout en restant dans le périmètre V1 (pas de backend, pas de commentaires dynamiques).

## 2. Éléments à ajouter

### 2.1 Lien "Voir toutes les nouveautés"

- Placer en haut de la section "Nouveautés", à droite du titre ou sous le titre.
- Lien textuel : **"Voir toutes les nouveautés"**.
- Cible : `/nos-derniers-livres-audio-gratuits.html` (page existante qui liste tous les livres triés par date).
- Style : texte en couleur primaire (`text-primary`) avec soulignement au survol.

### 2.2 Section "Le Choix de Claryssandre"

- Section dédiée sous les "Nouveautés".
- Titre : **"Le Choix de Claryssandre"**.
- Présente une sélection éditoriale de 4 livres.
- En V1, cette sélection est statique : on choisit 4 slugs de référence.
- Si un livre sélectionné n'est pas présent dans la collection locale (limite `FETCH_LIMIT`), on l'ignore silencieusement.
- Affichage : cartes `BookCard` sur 4 colonnes en desktop, 2 sur mobile.

**Livres proposés pour la sélection V1** (classiques représentatifs du catalogue) :
- `victor-hugo-notre-dame-de-paris`
- `gustave-flaubert-madame-bovary`
- `jules-verne-voyage-au-centre-de-la-terre`
- `alexandre-dumas-les-trois-mousquetaires`

En environnement de développement avec `FETCH_LIMIT` faible, on peut utiliser des slugs disponibles localement ; la logique filtre silencieusement les manquants. Si aucun livre de la sélection n'est trouvé, la section ne s'affiche pas.

### 2.3 Bloc newsletter

- Section en dessous du contenu principal, avant le footer (ou dans une colonne latérale si la sidebar le permet).
- En V1 : formulaire statique sans backend.
- Titre : **"Newsletter"** ou **"Restez informé"**.
- Champ email + bouton "S'inscrire".
- Message informatif en petit : "Inscription fictive en V1 — fonctionnalité active à venir."
- Le bouton n'envoie rien (pas de `fetch`) ; on peut ajouter un état React local qui affiche un message de remerciement.

### 2.4 Section "Derniers commentaires" (placeholder)

- Section optionnelle, tout en bas de la page d'accueil.
- En V1, afficher un message : **"Les commentaires seront disponibles prochainement."**
- Cela reproduit visuellement l'existence d'une zone commentaires sans implémenter le système dynamique.

## 3. Structure visuelle attendue de la page

```
[Header]
[Layout: sidebar | main]
main:
  - Section "Nouveautés" avec lien "Voir toutes les nouveautés"
  - Section "Le Choix de Claryssandre" (4 cartes)
  - Section "Les plus aimés"
  - Bloc newsletter
  - Section "Derniers commentaires" (placeholder)
[Footer]
```

## 4. Comportements

- La page reste statique (pré-rendue par Astro).
- Le formulaire newsletter est une île React (`client:visible`) minimale.
- Le lien "Voir toutes les nouveautés" pointe vers la page existante.
- "Le Choix de Claryssandre" est configurable via un tableau de slugs en haut de `index.astro`.

## 5. Critères de succès

- [ ] Le lien "Voir toutes les nouveautés" est visible et fonctionnel.
- [ ] La section "Le Choix de Claryssandre" affiche 4 livres avec `BookCard`.
- [ ] Le bloc newsletter s'affiche avec champ + bouton.
- [ ] La section "Derniers commentaires" placeholder est présente.
- [ ] `astro check` passe sans erreur.
- [ ] Le build réussit et la page d'accueil s'affiche correctement.
