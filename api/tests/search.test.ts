import { describe, it, expect, vi } from "vitest";
import { SearchQuery } from "../src/lib/zod";
import { buildSearchConditions } from "../src/routes/search";
import { and, sql, exists } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { db } from "../src/db/index";

vi.mock("../src/db/index", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  },
}));

describe("SearchQuery schema", () => {
  it("parse les valeurs par défaut", () => {
    const q = SearchQuery.parse({});
    expect(q).toEqual({ q: "", page: 1, genre: "", auteur: "", voix: "", periode: "" });
  });
  it("rejette une page négative", () => {
    expect(() => SearchQuery.parse({ page: "-1" })).toThrow();
  });
});

describe("buildSearchConditions", () => {
  it("returns TRUE when no filters are provided", () => {
    const result = buildSearchConditions({ q: "", genre: "", auteur: "", voix: "", periode: "" });
    expect(result).toEqual(sql`TRUE`);
  });

  it("builds a text search condition for q", () => {
    const result = buildSearchConditions({ q: "proust", genre: "", auteur: "", voix: "", periode: "" });
    const expected = and(
      sql`(${schema.books.title} ILIKE ${"%proust%"} OR ${schema.books.excerpt} ILIKE ${"%proust%"})`,
    );
    expect(result).toEqual(expected);
  });

  it("builds an exists subquery for the genre filter", () => {
    buildSearchConditions({ q: "", genre: "fiction", auteur: "", voix: "", periode: "" });
    expect(db.select).toHaveBeenCalled();
  });

  it("builds an exists subquery for the auteur filter", () => {
    buildSearchConditions({ q: "", genre: "", auteur: "marcel-proust", voix: "", periode: "" });
    expect(db.select).toHaveBeenCalled();
  });

  it("builds an exists subquery for the voix filter", () => {
    buildSearchConditions({ q: "", genre: "", auteur: "", voix: "jean-pierre", periode: "" });
    expect(db.select).toHaveBeenCalled();
  });

  it("builds an exists subquery for the periode filter", () => {
    buildSearchConditions({ q: "", genre: "", auteur: "", voix: "", periode: "19eme" });
    expect(db.select).toHaveBeenCalled();
  });

  it("combines q with multiple junction filters", () => {
    const result = buildSearchConditions({
      q: "recherche",
      genre: "fiction",
      auteur: "marcel-proust",
      voix: "jean-pierre",
      periode: "19eme",
    });
    expect(db.select).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
