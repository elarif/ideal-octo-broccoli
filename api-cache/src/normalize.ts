import type { RoutePolicy } from "./routes";

export function normalizeHeaders(src: Headers, policy: RoutePolicy): Headers {
  const h = new Headers(src);
  h.delete("set-cookie");
  h.delete("vary");
  h.set("cache-control", `public, max-age=${policy.ttl}, stale-while-revalidate=${policy.swr}`);
  h.set("content-type", h.get("content-type") || "application/json; charset=utf-8");
  h.set("x-la-cache", "MISS");
  return h;
}
