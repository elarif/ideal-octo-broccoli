import { env } from "./env";
import type { WpMedia, WpPost, WpTerm } from "../../scripts/lib/wp-types";

const DEFAULT_PER_PAGE = 100;

function buildUrl(path: string, params?: Record<string, string | number | undefined>): URL {
  const url = new URL(path, env.apiBase + "/");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url;
}

async function fetchJson<T>(url: URL): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WP API error ${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

function readTotalPages(res: Response): number {
  const header = res.headers.get("X-WP-TotalPages");
  return header ? Number(header) : 1;
}

function readTotal(res: Response): number {
  const header = res.headers.get("X-WP-Total");
  return header ? Number(header) : 0;
}

export const wpClient = {
  async listPosts(params?: { per_page?: number; page?: number }) {
    const url = buildUrl("/wp-json/wp/v2/posts", {
      _embed: 1,
      per_page: params?.per_page ?? DEFAULT_PER_PAGE,
      page: params?.page,
    });
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`WP posts error ${res.status}: ${body.slice(0, 500)}`);
    }
    const posts = (await res.json()) as WpPost[];
    return {
      posts,
      total: readTotal(res),
      totalPages: readTotalPages(res),
    };
  },

  async getPost(id: number): Promise<WpPost> {
    const url = buildUrl(`/wp-json/wp/v2/posts/${id}`, { _embed: 1 });
    return fetchJson<WpPost>(url);
  },

  async listTerms(taxonomy: string, params?: { per_page?: number; page?: number }) {
    const url = buildUrl(`/wp-json/wp/v2/${taxonomy}`, {
      per_page: params?.per_page ?? DEFAULT_PER_PAGE,
      page: params?.page,
    });
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`WP terms error ${res.status} for ${taxonomy}: ${body.slice(0, 500)}`);
    }
    return (await res.json()) as WpTerm[];
  },

  async getMediaChildren(postId: number, params?: { per_page?: number; page?: number }) {
    const url = buildUrl("/wp-json/wp/v2/media", {
      parent: postId,
      per_page: params?.per_page ?? DEFAULT_PER_PAGE,
      page: params?.page,
    });
    const res = await fetch(url);
    if (res.status === 400) {
      const body = await res.text();
      if (/rest_post_invalid_id/i.test(body)) {
        return [] as WpMedia[];
      }
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`WP media error ${res.status} for post ${postId}: ${body.slice(0, 500)}`);
    }
    return (await res.json()) as WpMedia[];
  },

  async* paginatePosts(perPage?: number) {
    let page = 1;
    let totalPages = 1;
    do {
      const batch = await this.listPosts({ per_page: perPage ?? DEFAULT_PER_PAGE, page });
      totalPages = batch.totalPages;
      for (const post of batch.posts) {
        yield post;
      }
      page++;
    } while (page <= totalPages);
  },
};
