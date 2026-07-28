import { pgTable, serial, integer, text, timestamp, char, primaryKey } from "drizzle-orm/pg-core";

export const books = pgTable("books", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").default(""),
  content: text("content").default(""),
  coverUrl: text("cover_url"),
  coverWidth: integer("cover_width"),
  coverHeight: integer("cover_height"),
  coverAlt: text("cover_alt"),
  durationTotal: integer("duration_total").notNull().default(0),
  views: integer("views").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull(),
  legacyUrl: text("legacy_url"),
});

export const tracks = pgTable("tracks", {
  id: integer("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  title: text("title").notNull(),
  url: text("url").notNull(),
  duration: integer("duration").default(0),
  sizeBytes: integer("size_bytes").default(0),
  slug: text("slug"),
  downloadCount: integer("download_count").default(0),
});

export const authors = pgTable("authors", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  letter: char("letter", { length: 1 }).notNull(),
  bookCount: integer("book_count").default(0),
});

export const voices = pgTable("voices", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  photoUrl: text("photo_url"),
  letter: char("letter", { length: 1 }).notNull(),
  bookCount: integer("book_count").default(0),
});

export const genres = pgTable("genres", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  bookCount: integer("book_count").default(0),
});

export const periods = pgTable("periods", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const regions = pgTable("regions", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const licenses = pgTable("licenses", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const bookAuthors = pgTable(
  "book_authors",
  {
    bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    authorId: integer("author_id").notNull().references(() => authors.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.bookId, t.authorId] }) }),
);

export const bookVoices = pgTable(
  "book_voices",
  {
    bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    voiceId: integer("voice_id").notNull().references(() => voices.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.bookId, t.voiceId] }) }),
);

export const bookGenres = pgTable(
  "book_genres",
  {
    bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    genreId: integer("genre_id").notNull().references(() => genres.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.bookId, t.genreId] }) }),
);

export const bookMeta = pgTable("book_meta", {
  bookId: integer("book_id").primaryKey().references(() => books.id, { onDelete: "cascade" }),
  periodId: integer("period_id").references(() => periods.id, { onDelete: "set null" }),
  regionId: integer("region_id").references(() => regions.id, { onDelete: "set null" }),
  licenseId: integer("license_id").references(() => licenses.id, { onDelete: "set null" }),
});
