import { describe, it, expect } from "vitest";
import { imageUrl } from "../src/lib/image-url";

describe("imageUrl", () => {
  it("cloudflare : /cdn-cgi/image/...", () => {
    const u = imageUrl("https://www.litteratureaudio.com/wp-content/uploads/2026/07/x.jpg",
      { width: 300, format: "avif" }, { transform: "cloudflare" });
    expect(u).toContain("/cdn-cgi/image/width=300,format=avif/");
    expect(u).toContain("uploads/2026/07/x.jpg");
  });
  it("raw : URL inchangée", () => {
    const u = imageUrl("https://.../x.jpg", { width: 300 }, { transform: "none" });
    expect(u).toBe("https://.../x.jpg");
  });
});
