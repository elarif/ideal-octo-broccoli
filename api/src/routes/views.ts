import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { books } from "../db/schema";
import { ViewsParams } from "../lib/zod";

const app = new Hono();

app.post("/:bookId", zValidator("param", ViewsParams), async (c) => {
  const { bookId } = c.req.valid("param");
  const updated = await db.update(books)
    .set({ views: sql`${books.views} + 1` })
    .where(eq(books.id, bookId))
    .returning({ views: books.views });
  if (updated.length === 0) return c.json({ error: "not_found" }, 404);
  return c.json(updated[0]);
});

export default app;
