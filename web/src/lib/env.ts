function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env var ${name} manquante`);
  return v;
}

export const env = {
  wpApiBase: required("WP_API_BASE"),
  siteUrl: process.env.SITE_URL || "https://litterature.pages.dev",
};
