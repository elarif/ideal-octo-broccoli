import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db/index";
import * as schema from "../db/schema";
import { sql } from "drizzle-orm";
import { SearchQuery } from "../lib/zod";

const app = new Hono();

app.get("/", zValidator("query", SearchQuery), async (c) => {
  const { q, page } = c.req.valid("query");
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = [sql`TRUE`];
  if (q) conditions.push(sql`(${schema.books.title} ILIKE ${`%${q}%`} OR ${schema.books.excerpt} ILIKE ${`%${q}%`})`);

  const results = await db.query.books.findMany({
    where: sql.join(conditions, sql` AND `),
    limit,
    offset,
    orderBy: sql`${schema.books.publishedAt} DESC`,
  });

  return c.json({ results, page, limit });
});

export default app;
