# Proxy cache WordPress — Design

> Date : 2026-08-01
> Auteur : OpenCode
> Objectif : Protéger le site original `litteratureaudio.com` des requêtes répétées du build et des visiteurs, tout en permettant de récupérer le catalogue complet progressivement.

---

## 1. Contexte

Le clone actuel interroge directement l’API WordPress du site original (`https://www.litteratureaudio.com/wp-json/wp/v2/`) à chaque build. Avec `FETCH_LIMIT=3000` et ~300 auteurs, chaque build génère plusieurs milliers de requêtes. Cela :
- martèle le serveur original,
- ralentit considérablement le build GitHub Actions (15+ minutes),
- rend le catalogue complet (~10 000 livres) impraticable.

## 2. Objectif

Créer un **proxy cache gratuit** déployé sur Cloudflare Workers qui :
- s’intercale entre le clone et l’API WordPress originale,
- met en cache les réponses JSON (posts, stations, termes, pages auteur),
- les sert depuis le cache Cloudflare sans re-contacter le site original,
- se remplit progressivement (cache miss = requête vers l’original + stockage),
- reste dans le plan gratuit Cloudflare.

## 3. Architecture

```
┌─────────────────┐     ┌──────────────────────────┐     ┌─────────────────────┐
│  GitHub Actions │────>│  Cloudflare Worker       │────>│  WordPress original │
│  (build clone)    │     │  + Cache API / KV        │     │  (source de vérité)   │
└─────────────────┘     └──────────────────────────┘     └─────────────────────┘
                              ▲
                              │
                         ┌────┘
                         │
                    ┌────┴────┐
                    │ Visiteurs │
                    │ (lecteur) │
                    └───────────┘
```

## 4. Composants

### 4.1 Worker Cloudflare

- **Fichier** : `proxy/src/index.ts` (dans un sous-projet séparé ou à la racine).
- **Route** : `https://cache.litteratureaudio.workers.dev/wp/v2/...`
- **Comportement** :
  - Reçoit une requête.
  - Construit la clé de cache à partir de l’URL complète.
  - Cherche dans le **Cache API** Cloudflare.
  - Si trouvé (HIT) : renvoie la réponse cachée.
  - Si absent (MISS) :
    - requête l’API WordPress originale avec les mêmes paramètres,
    - stocke la réponse dans le Cache API avec une durée de vie longue (30 jours),
    - renvoie la réponse au client.
  - Ajoute des headers informatifs : `X-Cache: HIT|MISS`, `Cache-Control: public, max-age=...`.

### 4.2 Cache API Cloudflare

- Cache natif du Worker.
- Durée de vie : **30 jours minimum**, renouvelé à chaque accès.
- Limite : dépend de l’offre gratuite Cloudflare (généralement suffisante pour des JSON textuels).
- Avantage : pas de limite de requêtes sur les HIT.

### 4.3 Script de fetch du clone (`web/scripts/fetch-content.ts`)

- Remplace `env.wpApiBase` par l’URL du Worker.
- Aucune autre modification nécessaire : le Worker se charge du cache.
- La première population reste lente, mais les builds suivants seront quasi instantanés.

### 4.4 GitHub Actions

- Ajouter une étape de **déploiement du Worker** dans `.github/workflows/deploy.yml`.
- Le Worker est déployé **avant** le build Astro.
- Le secret `CLOUDFLARE_API_TOKEN` existe déjà.

## 5. Endpoints à cacher

| Endpoint | Usage | Fréquence |
|---|---|---|
| `/wp-json/wp/v2/posts` | Liste paginée des livres | Très élevée |
| `/wp-json/wp/v2/station?include=...` | Détails des pistes playlist | Élevée |
| `/wp-json/wp/v2/media` | MP3 attachés (fallback) | Moyenne |
| `/wp-json/wp/v2/{taxonomy}` | Auteurs, voix, genres, etc. | Moyenne |
| `/livre-audio-gratuit-mp3/auteur/{slug}` | Page HTML auteur (portrait) | Élevée depuis l’ajout des portraits |

## 6. Stratégie de remplissage progressif

1. **Premier build** après mise en place du Worker :
   - Toutes les requêtes sont des MISS.
   - Le Worker remplit le cache au fur et à mesure.
   - Le build reste lent une dernière fois (~15–20 min pour 3000 livres).
2. **Builds suivants** :
   - Toutes les requêtes sont des HIT.
   - Build Astro seul : quelques dizaines de secondes.
   - Le site original n’est plus sollicité.
3. **Invalidation manuelle** :
   - Option `?refresh=1` ou endpoint `/admin/purge` protégé par secret pour forcer un MISS.

## 7. Gestion des erreurs et limites

- Si le site original renvoie une erreur, le Worker renvoie l’erreur sans mettre en cache.
- Si le cache est plein, Cloudflare éjecte les entrées les moins utilisées (LRU).
- Le Worker respecte les headers `Cache-Control` de l’original s’ils existent, sinon force un TTL long.

## 8. Plan gratuit Cloudflare Workers

| Quota | Valeur |
|---|---|
| Requêtes/jour | 100 000 |
| CPU ms par invocation | 50 ms (gratuit) |
| Stockage Cache API | pas de limite dure documentée |
| KV (si besoin) | 1 GB max |

Le plan gratuit suffit amplement pour le cache d’API JSON.

## 9. Critères de succès

- [ ] Worker déployé et fonctionnel.
- [ ] Le build du clone avec `FETCH_LIMIT=3000` passe sous les 5 minutes après le premier remplissage.
- [ ] Le site original n’est plus sollicité lors des builds suivants.
- [ ] Le cache est partagé entre GitHub Actions et les visiteurs.
- [ ] Possibilité de forcer un rafraîchissement.

## 10. Prochaines étapes

Écrire le plan d’implémentation puis exécuter :
1. Créer le sous-projet Worker.
2. Modifier `wp-client.ts` / `env.ts` pour pointer vers le Worker.
3. Ajouter le déploiement du Worker dans GitHub Actions.
4. Tester avec un build complet.
5. Documenter l’URL du Worker et la procédure de purge.
