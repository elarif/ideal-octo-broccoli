import { z } from "zod";

export const SearchQuery = z.object({
  q: z.string().default(""),
  page: z.coerce.number().int().min(1).default(1),
  genre: z.string().default(""),
  auteur: z.string().default(""),
  voix: z.string().default(""),
  periode: z.string().default(""),
});

export const ViewsParams = z.object({
  bookId: z.coerce.number().int().positive(),
});
