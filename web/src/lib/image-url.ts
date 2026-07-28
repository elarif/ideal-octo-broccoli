export type ImageTransform = "cloudflare" | "imgproxy" | "none";

export interface ImageUrlOpts {
  width?: number;
  format?: "avif" | "webp" | "jpg" | "png";
  height?: number;
  quality?: number;
}

export interface ImageUrlConfig {
  transform: ImageTransform;
  imgproxyBase?: string;
}

export function imageUrl(src: string, opts: ImageUrlOpts, config: ImageUrlConfig): string {
  if (config.transform === "none") return src;
  if (config.transform === "cloudflare") {
    const params = [
      opts.width && `width=${opts.width}`,
      opts.format && `format=${opts.format}`,
      opts.quality && `quality=${opts.quality}`,
      opts.height && `height=${opts.height}`,
    ].filter(Boolean).join(",");
    const path = src.replace(/^https?:\/\/[^/]+/, "");
    return `https://www.litteratureaudio.com/cdn-cgi/image/${params}${path}`;
  }
  const enc = Buffer.from(src).toString("base64url");
  const optsStr = `w:${opts.width || 0}`;
  return `${config.imgproxyBase}/${optsStr}/${enc}`;
}
