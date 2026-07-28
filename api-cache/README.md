# api-cache — Cloudflare Worker

Met en cache les réponses de l'API REST publique de WordPress pour le front Astro pendant la transition.

## Développement

```bash
pnpm install
pnpm dev
```

## Tests

```bash
pnpm test
```

## Déploiement

```bash
pnpm deploy
```

La variable `WP_ORIGIN` est définie dans `wrangler.toml`. Pour la surcharger en production, utiliser `wrangler secret` ou les variables d'environnement Cloudflare.
