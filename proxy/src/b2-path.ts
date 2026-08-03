import { normalizeSlug } from "./normalize";

export function buildB2Key(
  bookSlug: string,
  voiceSlug: string,
  order: number,
  trackSlug: string
): string {
  const paddedOrder = String(order + 1).padStart(2, "0");
  const truncatedSlug = trackSlug.slice(0, 60);
  return `mp3/${normalizeSlug(bookSlug)}/${normalizeSlug(voiceSlug) || "unknown"}/${paddedOrder}-${normalizeSlug(truncatedSlug)}.mp3`;
}