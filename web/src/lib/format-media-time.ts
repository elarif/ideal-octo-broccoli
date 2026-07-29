export function formatMediaTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  const h = Math.floor(m / 60);
  const mm = h > 0 ? m % 60 : m;
  const padded = rem.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm.toString().padStart(2, "0")}:${padded}` : `${mm}:${padded}`;
}
