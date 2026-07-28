import { defineCollection, z } from "astro:content";

const Track = z.object({
  id: z.number(),
  slug: z.string().default(""),
  title: z.string(),
  order: z.number(),
  url: z.string().url(),
  duration: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
  downloadCount: z.number().int().nonnegative().default(0),
});

const Image = z.object({
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().default(""),
});

const TermRef = z.object({ id: z.number(), slug: z.string(), name: z.string() });

const books = defineCollection({
  type: "data",
  schema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
    title: z.string(),
    excerpt: z.string().default(""),
    content: z.string().default(""),
    cover: Image.optional(),
    durationTotal: z.number().int().nonnegative(),
    authors: z.array(TermRef),
    voices: z.array(TermRef),
    genres: z.array(TermRef),
    period: TermRef.optional(),
    region: TermRef.optional(),
    license: TermRef.optional(),
    tracks: z.array(Track),
    views: z.number().int().nonnegative().default(0),
    publishedAt: z.coerce.date(),
    modifiedAt: z.coerce.date(),
    legacyUrl: z.string().url(),
  }),
});

const authors = defineCollection({
  type: "data",
  schema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
    name: z.string(),
    description: z.string().default(""),
    bookCount: z.number().int().nonnegative().default(0),
    letter: z.string().length(1),
  }),
});

const voices = defineCollection({
  type: "data",
  schema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
    name: z.string(),
    description: z.string().default(""),
    photo: Image.optional(),
    bookCount: z.number().int().nonnegative().default(0),
    letter: z.string().length(1),
  }),
});

const genres = defineCollection({
  type: "data",
  schema: z.object({
    id: z.number().int().positive(),
    slug: z.string(),
    name: z.string(),
    description: z.string().default(""),
    bookCount: z.number().int().nonnegative().default(0),
  }),
});

export const collections = { books, authors, voices, genres };
