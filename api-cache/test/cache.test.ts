import { describe, it, expect } from "vitest";
import { makeCacheKey } from "../src/cache";

describe("makeCacheKey", () => {
  it("inclut l'URL complète normalisée", () => {
    const key = makeCacheKey(new Request("https://api.la.test/wp-json/wp/v2/posts?per_page=10"));
    expect(key).toContain("/wp-json/wp/v2/posts?per_page=10");
  });
  it("ignore les query params de cache-busting", () => {
    const a = makeCacheKey(new Request("https://api.la.test/wp-json/wp/v2/posts?_=123"));
    const b = makeCacheKey(new Request("https://api.la.test/wp-json/wp/v2/posts"));
    expect(a).toBe(b);
  });
  it("ignore le cache-busting mêlé à d'autres paramètres", () => {
    const a = makeCacheKey(new Request("https://api.la.test/wp-json/wp/v2/posts?foo=1&_=123"));
    const b = makeCacheKey(new Request("https://api.la.test/wp-json/wp/v2/posts?_=123&foo=1"));
    const c = makeCacheKey(new Request("https://api.la.test/wp-json/wp/v2/posts?foo=1"));
    expect(a).toBe("/wp-json/wp/v2/posts?foo=1");
    expect(b).toBe("/wp-json/wp/v2/posts?foo=1");
    expect(c).toBe("/wp-json/wp/v2/posts?foo=1");
    expect(a).toBe(b);
    expect(a).toBe(c);
  });
  it("ignore tous les params de cache-busting multiples", () => {
    const key = makeCacheKey(new Request("https://api.la.test/wp-json/wp/v2/posts?foo=1&_=123&_=456&bar=2"));
    expect(key).toBe("/wp-json/wp/v2/posts?foo=1&bar=2");
  });
});
