import { describe, it, expect } from "vitest";
import { SearchQuery } from "../src/lib/zod";

describe("SearchQuery schema", () => {
  it("parse les valeurs par défaut", () => {
    const q = SearchQuery.parse({});
    expect(q).toEqual({ q: "", page: 1, genre: "", auteur: "", voix: "", periode: "" });
  });
  it("rejette une page négative", () => {
    expect(() => SearchQuery.parse({ page: "-1" })).toThrow();
  });
});
