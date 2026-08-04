# Agent Notes — Litteratureaudio Clone

## Project Structure

- `web/` — Astro 4 static site package (`@la/web`).
- `proxy/` — Cloudflare Worker proxy cache for WordPress data.
- `docs/superpowers/` — Design specs and implementation plans.

## Build & Deployment

- Package manager: `pnpm`.
- Web build: `cd web && pnpm build` or `pnpm --filter @la/web run build`.
- Worker deploy: `cd proxy && pnpm deploy`.
- GitHub Actions deploys both the Worker and the Astro site on push to `main`.
- Weekly scheduled sync: every Sunday at 03:00 UTC.

## Environment Variables

### Required in GitHub Actions

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Workers + Pages permissions.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `WP_API_BASE` — WordPress origin, e.g. `https://www.litteratureaudio.com`.
- `SYNC_SECRET` — Secret token for `/admin/sync` endpoint.
- `B2_APPLICATION_KEY_ID` and `B2_APPLICATION_KEY` — Backblaze B2 credentials (Phase 2).

### GitHub Variables

- `SITE_URL` — Public site URL (default `https://litteratureaudio.pages.dev`).
- `WP_PROXY_URL` — Worker URL (default `https://litteratureaudio-cache.elarif-ahamada.workers.dev`).
- `FETCH_LIMIT` — Number of books to fetch per build (default `500`).

## Worker Configuration

Before deploying the Worker for the first time:

1. Create a D1 database named `litteratureaudio` in Cloudflare.
2. Create a KV namespace for sync state.
3. Replace `__D1_DATABASE_ID__` and `__KV_NAMESPACE_ID__` in `proxy/wrangler.toml`.
4. Set the `SYNC_SECRET` as a Worker secret in Cloudflare.

## MP3 Storage Naming Convention

Backblaze B2 bucket `litteratureaudio-media` uses the following layout:

```
mp3/{book-slug}/{voice-slug}/{order}-{track-slug}.mp3
```

For example:

```
mp3/jules-verne-deux-ans-de-vacances/lyra/01-chap-01-deux-ans-de-vacances.mp3
```

- `{book-slug}` — WordPress post slug, normalized, unique.
- `{voice-slug}` — Narrator slug, or `unknown`.
- `{order}` — Zero-padded track index (01, 02, ...).
- `{track-slug}` — Normalized track title, truncated to 60 chars.

## Sync Procedure

To populate or refresh the Worker cache:

```bash
curl -X POST "https://litteratureaudio-cache.elarif-ahamada.workers.dev/admin/sync" \
  -H "Authorization: Bearer <SYNC_SECRET>" \
  -H "Content-Type: application/json"
```

For incremental sync since the last run, the weekly schedule calls this automatically.

## Phase 2: Media Storage (Deployed)

- Backblaze B2 bucket `litteratureaudio-media` (region `eu-central-003`).
- Served via Backblaze B2 native endpoint `https://f003.backblazeb2.com` (free egress up to 1GB/day, then $0.01/GB; Bandwidth Alliance free unlimited egress requires a Cloudflare CNAME on a registered domain — not configured yet since `litteratureaudio.pages.dev` is a Pages-managed subdomain with no custom DNS zone).
- MP3 popular/recent content mirrored from WordPress to B2.
- Bulk mirror: `pnpm mirror:mp3` in `proxy/` or GitHub Actions `mirror-mp3` job.
- Incremental: Worker `/admin/sync/mp3` (weekly schedule + on-demand).
- Worker endpoints:
  - `GET /api/tracks?missing_b2=true&limit=N` — list tracks needing mirror.
  - `POST /admin/tracks/:id` — update `b2_url` (auth: SYNC_SECRET).
  - `POST /admin/sync/mp3` — lazy-fill up to 20 tracks (auth: SYNC_SECRET).
- D1 `tracks.b2_url` stores the CDN URL once mirrored.
- Astro build prefers `b2_url` over WordPress `source_url` in book JSON.

## Cost Estimates

See `docs/superpowers/specs/2026-08-01-proxy-cache-wordpress-design.md` for detailed growth scenarios.
