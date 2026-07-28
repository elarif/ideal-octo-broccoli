import { env } from "./env";

export interface WpTerm {
  id: number;
  slug: string;
  name: string;
}

export interface WpPost {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  date_gmt: string;
  modified_gmt: string;
  featured_media: number;
  auteur: number[];
  voix: number[];
  genre_livre: number[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url: string;
      alt_text: string;
      media_details: { width: number; height: number };
    }>;
    "wp:term"?: Array<Array<WpTerm & { taxonomy: string }>>;
  };
}

export interface WpMedia {
  id: number;
  slug: string;
  title: { rendered: string };
  mime_type: string;
  source_url: string;
  post?: number;
  media_details?: { filesize?: number; length?: number; menu_order?: number };
}

class WpClient {
  private base: string;
  constructor(base: string) { this.base = base.replace(/\/$/, ""); }

  private async req(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<{ data: unknown; headers: Headers }> {
    const url = new URL(`${this.base}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      const key = k === "embed" ? "_embed" : k === "perPage" ? "per_page" : k;
      url.searchParams.set(key, String(v));
    }
    const resp = await fetch(url.toString(), { headers: { accept: "application/json" } });
    if (!resp.ok) throw new Error(`WP API ${resp.status} ${url.toString()}`);
    return { data: await resp.json(), headers: resp.headers };
  }

  async *paginatePosts(): AsyncGenerator<WpPost> {
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const { data, headers } = await this.req("/wp-json/wp/v2/posts", { perPage: 100, page, embed: true });
      const posts = data as WpPost[];
      totalPages = Number(headers.get("x-wp-totalpages") || 1);
      for (const p of posts) yield p;
      page++;
    }
  }

  async getMediaChildren(postId: number): Promise<WpMedia[]> {
    const all: WpMedia[] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      try {
        const { data, headers } = await this.req("/wp-json/wp/v2/media", {
          parent: postId, perPage: 100, page, orderby: "menu_order", order: "asc",
        });
        all.push(...(data as WpMedia[]));
        totalPages = Number(headers.get("x-wp-totalpages") || 1);
      } catch (e) {
        const msg = String(e);
        if (msg.includes("rest_post_invalid_id") || msg.includes("400")) return all;
        throw e;
      }
      page++;
    }
    return all.filter((m) => m.mime_type.startsWith("audio/"));
  }
}

export const wpClient = new WpClient(env.wpApiBase);
