function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

export const env = {
  apiBase: normalizeBase(process.env.LA_API_BASE ?? "https://www.litteratureaudio.com"),
};
