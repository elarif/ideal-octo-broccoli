import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db/index";
import * as schema from "../db/schema";
import { and, eq, sql, exists, type SQL } from "drizzle-orm";
import { SearchQuery } from "../lib/zod";

export function buildSearchConditions(query: {
  q: string;
  genre: string;
  auteur: string;
  voix: string;
  periode: string;
}) {
  const conditions: SQL[] = [];

  if (query.q) {
    conditions.push(
      sql`(${schema.books.title} ILIKE ${`%${query.q}%`} OR ${schema.books.excerpt} ILIKE ${`%${query.q}%`})`,
    );
  }

  if (query.genre) {
    const g = schema.genres;
    const bg = schema.bookGenres;
    conditions.push(
      exists(
        db
          .select()
          .from(bg)
          .innerJoin(g, eq(bg.genreId, g.id))
          .where(and(eq(bg.bookId, schema.books.id), eq(g.slug, query.genre))),
      ),
    );
  }

  if (query.auteur) {
    const a = schema.authors;
    const ba = schema.bookAuthors;
    conditions.push(
      exists(
        db
          .select()
          .from(ba)
          .innerJoin(a, eq(ba.authorId, a.id))
          .where(and(eq(ba.bookId, schema.books.id), eq(a.slug, query.auteur))),
      ),
    );
  }

  if (query.voix) {
    const v = schema.voices;
    const bv = schema.bookVoices;
    conditions.push(
      exists(
        db
          .select()
          .from(bv)
          .innerJoin(v, eq(bv.voiceId, v.id))
          .where(and(eq(bv.bookId, schema.books.id), eq(v.slug, query.voix))),
      ),
    );
  }

  if (query.periode) {
    const p = schema.periods;
    conditions.push(
      exists(
        db
          .select()
          .from(schema.bookMeta)
          .innerJoin(p, eq(schema.bookMeta.periodId, p.id))
          .where(
            and(eq(schema.bookMeta.bookId, schema.books.id), eq(p.slug, query.periode)),
          ),
      ),
    );
  }

  return conditions.length > 0 ? and(...conditions) : sql`TRUE`;
}

const app = new Hono();

app.get("/", zValidator("query", SearchQuery), async (c) => {
  const query = c.req.valid("query");
  const limit = 20;
  const offset = (query.page - 1) * limit;

  const where = buildSearchConditions(query);

  const results = await db.query.books.findMany({
    where,
    limit,
    offset,
    orderBy: sql`${schema.books.publishedAt} DESC`,
  });

  const countRow = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(schema.books)
    .where(where);

  const total = countRow[0]?.total ?? 0;
  const hasNextPage = query.page * limit < total;

  return c.json({ results, total, page: query.page, limit, hasNextPage });
});

export default app;
