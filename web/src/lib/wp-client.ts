import { env } from "./env";

export interface WpListParams {
  page?: number;
  perPage?: number;
  search?: string;
  embed?: boolean;
  [k: string]: string | number | boolean | undefined;
}

export interface WpPost {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media: number;
  date_gmt: string;
  modified_gmt: string;
  auteur: number[];
  voix: number[];
  genre_livre: number[];
  periode: number[];
  region: number[];
  licence: number[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url: string;
      alt_text: string;
      media_details: { width: number; height: number; sizes: Record<string, { source_url: string; width: number; height: number }> };
    }>;
    "wp:term"?: Array<Array<{ id: number; slug: string; name: string; taxonomy: string }>>;
  };
}

export interface WpMedia {
  id: number;
  slug: string;
  title: { rendered: string };
  mime_type: string;
  source_url: string;
  media_details?: { filesize?: number; length?: number; menu_order?: number };
}

export interface WpTerm {
  id: number;
  slug: string;
  name: string;
  description: string;
  count: number;
}

class WpClient {
  private base: string;
  constructor(base: string) { this.base = base.replace(/\/$/, ""); }

  private async req(path: string, params: WpListParams = {}): Promise<{ data: unknown; headers: Headers }> {
    const url = new URL(`${this.base}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k === "embed" ? "_embed" : k, String(v));
    }
    const resp = await fetch(url.toString(), { headers: { accept: "application/json" } });
    if (!resp.ok) throw new Error(`WP API ${resp.status} ${url.toString()}`);
    return { data: await resp.json(), headers: resp.headers };
  }

  async listPosts(params: WpListParams = {}): Promise<{ posts: WpPost[]; totalPages: number; total: number }> {
    const { data, headers } = await this.req("/wp-json/wp/v2/posts", { perPage: 100, ...params });
    return {
      posts: data as WpPost[],
      totalPages: Number(headers.get("x-wp-totalpages") || 1),
      total: Number(headers.get("x-wp-total") || 0),
    };
  }

  async getPost(id: number, { embed = true } = {}): Promise<WpPost> {
    const { data } = await this.req(`/wp-json/wp/v2/posts/${id}`, { embed });
    return data as WpPost;
  }

  async listTerms(taxonomy: string): Promise<WpTerm[]> {
    const all: WpTerm[] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const { data, headers } = await this.req(`/wp-json/wp/v2/${taxonomy}`, { perPage: 100, page });
      all.push(...(data as WpTerm[]));
      totalPages = Number(headers.get("x-wp-totalpages") || 1);
      page++;
    }
    return all;
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (/\b400\b/.test(msg)) {
          // parent invalide ou autre erreur WP => pas de médias enfants
          return [];
        }
        throw err;
      }
      page++;
    }
    return all.filter((m) => m.mime_type.startsWith("audio/"));
  }

  async *paginatePosts(): AsyncGenerator<WpPost> {
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const { posts, totalPages: tp } = await this.listPosts({ page, embed: true });
      totalPages = tp;
      for (const p of posts) yield p;
      page++;
    }
  }
}

export const wpClient = new WpClient(env.apiBase);
