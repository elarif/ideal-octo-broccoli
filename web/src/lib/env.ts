function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env var ${name} manquante. Définir dans .env ou CI.`);
  return v;
}

export const env = {
  apiBase: required("LA_API_BASE"),
  siteUrl: process.env.SITE_URL || "https://www.litteratureaudio.com",
  imageTransform: (process.env.LA_IMAGE_TRANSFORM || "none") as "none" | "cloudflare" | "imgproxy",
};
