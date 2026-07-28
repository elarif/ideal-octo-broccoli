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
});
