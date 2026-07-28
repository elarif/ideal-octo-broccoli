# Litteratureaudio.com — MVP V0

Front statique Astro alimenté par l'API REST publique de WordPress.

## Développement

```bash
pnpm install
cd web
pnpm dev
```

## Build

```bash
cd web
pnpm build
```

Le build lance `fetch-content.ts` qui récupère les livres depuis l'API WordPress.
