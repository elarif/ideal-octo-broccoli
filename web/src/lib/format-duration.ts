export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0 min";
  const m = Math.ceil(seconds / 60);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${m} min`;
  if (rem === 0) return `${h} h`;
  return `${h} h ${rem} min`;
}
