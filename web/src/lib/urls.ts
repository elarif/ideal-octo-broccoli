export function pageUrl(path: string): string {
  if (path.startsWith("http") || path.startsWith("#") || path.startsWith("mailto:")) return path;
  const clean = path.replace(/^\//, "").replace(/\.html$/i, "");
  if (!clean) return "/";
  return `/${clean}.html`;
}
