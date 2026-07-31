import type { CollectionEntry } from "astro:content";
import type { AudioBook } from "../types/audio";

export function toAudioBook(book: CollectionEntry<"books">): AudioBook {
  const d = book.data;
  return {
    slug: d.slug,
    title: d.title,
    authorsLabel: d.authors.map((a) => a.name).join(", "),
    coverUrl: d.cover?.url,
    tracks: d.tracks.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      url: t.url,
      duration: t.duration,
    })),
  };
}
