import { env } from "./env";

export interface WpTerm {
  id: number;
  slug: string;
  name: string;
  description?: string;
  count?: number;
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
  meta?: {
    duration?: number;
    stream?: string;
    download_url?: string;
    type?: "single" | "playlist";
    items?: string[];
    "post-count-all"?: number;
    like_count?: number;
  };
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
  meta?: {
    duration?: number;
    download_url?: string;
  };
}

class WpClient {
  private base: string;
  constructor(base: string) { this.base = base.replace(/\/$/, ""); }

  private resolvePath(path: string): string {
    if (env.wpProxyUrl) {
      return `${env.wpProxyUrl}${path.replace("/wp-json", "/wp")}`;
    }
    return `${this.base}${path}`;
  }

  private async req(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<{ data: unknown; headers: Headers }> {
    const url = new URL(this.resolvePath(path));
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
    const perPage = env.wpProxyUrl ? 25 : 100;
    while (page <= totalPages) {
      const { data, headers } = await this.req("/wp-json/wp/v2/posts", { perPage, page, embed: true });
      const posts = data as WpPost[];
      totalPages = Number(headers.get("x-wp-totalpages") || 1);
      for (const p of posts) yield p;
      page++;
    }
  }

  async *paginateTerms(taxonomy: string): AsyncGenerator<WpTerm> {
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const { data, headers } = await this.req(`/wp-json/wp/v2/${taxonomy}`, {
        perPage: 100,
        page,
        hide_empty: true,
        _fields: "id,slug,name,description,count",
      });
      const terms = data as WpTerm[];
      totalPages = Number(headers.get("x-wp-totalpages") || 1);
      for (const t of terms) yield t;
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
          post: postId, perPage: 100, page, orderby: "menu_order", order: "asc",
        });
        all.push(...(data as WpMedia[]));
        totalPages = Number(headers.get("x-wp-totalpages") || 1);
      } catch {
        return all;
      }
      page++;
    }
    return all.filter((m) => m.mime_type?.startsWith("audio/"));
  }

  async getMediaByIds(ids: number[]): Promise<WpMedia[]> {
    if (!ids.length) return [];
    const { data } = await this.req("/wp-json/wp/v2/media", {
      include: ids.join(","),
      perPage: 100,
    });
    return data as WpMedia[];
  }

  async getStationsByIds(ids: number[]): Promise<WpStation[]> {
    if (!ids.length) return [];
    const { data } = await this.req("/wp-json/wp/v2/station", {
      include: ids.join(","),
      perPage: 100,
      _fields: "id,slug,title,meta",
    });
    return data as WpStation[];
  }
}

export interface WpStation {
  id: number;
  slug: string;
  title: { rendered: string };
  meta?: {
    duration?: number;
    stream?: string;
    download_url?: string;
  };
}

export const wpClient = new WpClient(env.wpApiBase);
