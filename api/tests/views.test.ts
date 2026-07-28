import { describe, it, expect } from "vitest";
import { ViewsParams } from "../src/lib/zod";

describe("ViewsParams schema", () => {
  it("parse un bookId positif", () => {
    expect(ViewsParams.parse({ bookId: "123" })).toEqual({ bookId: 123 });
  });
  it("rejette un bookId invalide", () => {
    expect(() => ViewsParams.parse({ bookId: "abc" })).toThrow();
  });
});
