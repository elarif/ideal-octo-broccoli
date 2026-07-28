import { describe, it, expect } from "vitest";
import { matchRoute } from "../src/routes";

describe("matchRoute", () => {
  it("cache la liste des posts avec SWR 60s/1h", () => {
    const r = matchRoute("/wp-json/wp/v2/posts?per_page=100&_embed");
    expect(r).toEqual({ cacheable: true, ttl: 60, swr: 3600 });
  });
  it("cache un post individuel plus longtemps", () => {
    const r = matchRoute("/wp-json/wp/v2/posts/373132?_embed");
    expect(r).toEqual({ cacheable: true, ttl: 300, swr: 7200 });
  });
  it("cache les taxonomies au moins 1h", () => {
    const r = matchRoute("/wp-json/wp/v2/taxonomies");
    expect(r?.cacheable).toBe(true);
    expect(r!.ttl).toBeGreaterThanOrEqual(3600);
  });
  it("ne cache pas les routes admin", () => {
    expect(matchRoute("/wp-admin/admin-ajax.php")).toBeNull();
    expect(matchRoute("/wp-json/wp/v2/users/me")).toBeNull();
  });
  it("ne cache pas les routes non-wp-json", () => {
    expect(matchRoute("/livre-audio-gratuit-mp3/x.html")).toBeNull();
  });
});
