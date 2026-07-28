import { matchRoute } from "./routes";
import { serveFromCache, fetchAndCache } from "./cache";

export interface Env {
  WP_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const policy = matchRoute(url.pathname + url.search);
    if (!policy || !policy.cacheable) {
      const upstream = new URL(url);
      upstream.hostname = new URL(env.WP_ORIGIN).hostname;
      return fetch(new Request(upstream, request));
    }
    const cached = await serveFromCache(request, env, ctx);
    if (cached) {
      const fresh = new Response(cached.body, cached);
      fresh.headers.set("x-la-cache", "HIT");
      const age = Number(fresh.headers.get("age") || 0);
      if (age > policy.ttl) {
        ctx.waitUntil(fetchAndCache(request, env, policy).catch(() => {}));
      }
      return fresh;
    }
    const fresh = await fetchAndCache(request, env, policy);
    fresh.headers.set("x-la-cache", "MISS");
    return fresh;
  },
};
