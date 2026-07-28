import { describe, it, expect } from "vitest";
import { formatDuration } from "../src/lib/format-duration";

describe("formatDuration", () => {
  it("secondes < 60 → 'X min' (arrondi sup)", () => {
    expect(formatDuration(30)).toBe("1 min");
    expect(formatDuration(0)).toBe("0 min");
  });
  it("minutes pleines", () => {
    expect(formatDuration(900)).toBe("15 min");
  });
  it("heures + minutes", () => {
    expect(formatDuration(4980)).toBe("1 h 23 min");
  });
  it("heures pleines sans minutes", () => {
    expect(formatDuration(3600)).toBe("1 h");
  });
});
