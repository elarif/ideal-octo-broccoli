import type { RoutePolicy } from "./routes";
import { normalizeHeaders } from "./normalize";

const CACHE_BUST = /([?&]_=\d+)/;

export function makeCacheKey(req: Request): string {
  const url = new URL(req.url);
  url.search = url.search.replace(CACHE_BUST, "").replace(/^[?&]/, "?");
  return url.pathname + url.search;
}

export async function serveFromCache(
  request: Request,
  _env: unknown,
  _ctx: ExecutionContext,
): Promise<Response | null> {
  const key = makeCacheKey(request);
  const cached = await caches.default.match(key);
  if (!cached) return null;
  return cached.clone();
}

export async function fetchAndCache(
  request: Request,
  env: { WP_ORIGIN: string },
  policy: RoutePolicy,
): Promise<Response> {
  const upstream = new URL(request.url);
  upstream.hostname = new URL(env.WP_ORIGIN).hostname;
  const upstreamReq = new Request(upstream, request);
  upstreamReq.headers.delete("cookie");
  const resp = await fetch(upstreamReq);
  const body = await resp.arrayBuffer();
  const out = new Response(body, {
    status: resp.status,
    headers: normalizeHeaders(resp.headers, policy),
  });
  if (resp.ok) {
    const key = makeCacheKey(request);
    await caches.default.put(key, out.clone());
  }
  return out;
}
