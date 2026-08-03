import { Router, IRequest } from "itty-router";
import { normalizeSlug } from "./normalize";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  WP_API_BASE: string;
  SYNC_SECRET: string;
  B2_APPLICATION_KEY_ID?: string;
  B2_APPLICATION_KEY?: string;
  B2_BUCKET_NAME?: string;
}

interface WpPost {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  date_gmt: string;
  modified_gmt: string;
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

interface WpMedia {
  id: number;
  slug: string;
  title: { rendered: string };
  mime_type: string;
  source_url: string;
  post?: number;
  media_details?: { filesize?: number; length?: number; menu_order?: number };
  meta?: { duration?: number; download_url?: string };
}

interface WpStation {
  id: number;
  slug: string;
  title: { rendered: string };
  meta?: { duration?: number; stream?: string; download_url?: string };
}

interface WpTerm {
  id: number;
  slug: string;
  name: string;
  description?: string;
  count?: number;
  taxonomy?: string;
}

const TAXONOMY_MAP: Record<string, string> = {
  auteur: "authors",
  voix: "voices",
  genre_livre: "genres",
  periode: "periods",
  region: "regions",
  licence: "licences",
  post_tag: "tags",
};

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

async function fetchFromWP(env: Env, path: string, params: Record<string, string> = {}, attempt = 1): Promise<unknown> {
  const url = new URL(`${env.WP_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!resp.ok) {
    const shouldRetry = attempt <= 1 && (resp.status >= 500 || resp.status === 429);
    if (shouldRetry) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return fetchFromWP(env, path, params, attempt + 1);
    }
    throw new Error(`WP API ${resp.status} ${url.toString()}`);
  }
  return await resp.json();
}

function htmlDecode(input: string): string {
  return input
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (_, name) => {
      const entities: Record<string, string> = {
        amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘",
        rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", nbsp: " ",
      };
      return entities[name] || `&${name};`;
    })
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));
}

function termMap(post: WpPost, taxonomy: string): WpTerm[] {
  const groups = post._embedded?.["wp:term"] || [];
  for (const group of groups) {
    const matched = group.filter((t) => t.taxonomy === taxonomy);
    if (matched.length) return matched.map((t) => ({ id: t.id, slug: normalizeSlug(t.slug), name: htmlDecode(t.name), description: t.description, count: t.count, taxonomy: t.taxonomy }));
  }
  return [];
}

function extractCover(post: WpPost) {
  const fm = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!fm) return undefined;
  return { url: fm.source_url, width: fm.media_details.width, height: fm.media_details.height, alt: htmlDecode(fm.alt_text || post.title.rendered) };
}

function parseItemId(item: string): number | undefined {
  const match = item.match(/^\s*(\d+)\s*:/);
  return match ? Number(match[1]) : undefined;
}

function msToSec(ms?: number): number {
  return Math.round((ms ?? 0) / 1000);
}

async function fetchTracksForPost(env: Env, post: WpPost): Promise<WpMedia[]> {
  const type = post.meta?.type ?? "single";
  const stream = post.meta?.stream;
  const downloadUrl = post.meta?.download_url;
  const items = post.meta?.items;

  if (type === "single" && (stream || downloadUrl)) {
    return [{
      id: post.id,
      slug: normalizeSlug(post.slug),
      title: post.title,
      mime_type: "audio/mpeg",
      source_url: stream || downloadUrl || "",
      media_details: { length: msToSec(post.meta?.duration), filesize: 0, menu_order: 0 },
    }];
  }

  if (items && items.length > 0) {
    const ids = items.map(parseItemId).filter((id): id is number => id !== undefined && !Number.isNaN(id));
    if (ids.length) {
      const data = await fetchFromWP(env, "/wp-json/wp/v2/station", { include: ids.join(","), per_page: "100", _fields: "id,slug,title,meta" }) as WpStation[];
      const byId = new Map(data.map((s) => [s.id, s]));
      return ids.map((id, i) => {
        const s = byId.get(id);
        const itemLabel = items[i]?.replace(/^\s*\d+\s*:\s*/, "") || `Piste ${i + 1}`;
        const url = s?.meta?.stream || s?.meta?.download_url || "";
        return {
          id,
          slug: normalizeSlug(s?.slug || `${post.slug}-${i + 1}`),
          title: { rendered: s?.title?.rendered || itemLabel },
          mime_type: "audio/mpeg",
          source_url: url,
          meta: { duration: s?.meta?.duration || 0, download_url: s?.meta?.download_url || "" },
          media_details: { length: msToSec(s?.meta?.duration), filesize: 0, menu_order: i },
        } as WpMedia;
      }).filter((m) => (m.source_url || m.meta?.download_url || "").startsWith("http"));
    }
  }

  const all: WpMedia[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    try {
      const data = await fetchFromWP(env, "/wp-json/wp/v2/media", {
        parent: String(post.id),
        per_page: "100",
        page: String(page),
        orderby: "menu_order",
        order: "asc",
      }) as WpMedia[];
      all.push(...data);
      totalPages = data.length === 100 ? page + 1 : page;
    } catch {
      break;
    }
    page++;
  }
  return all.filter((m) => m.mime_type?.startsWith("audio/"));
}

async function fetchAuthorPortrait(slug: string, name: string): Promise<{ url: string; alt: string } | undefined> {
  try {
    const url = `https://www.litteratureaudio.com/livre-audio-gratuit-mp3/auteur/${slug}`;
    const resp = await fetch(url, { headers: { accept: "text/html" } });
    if (!resp.ok) return undefined;
    const html = await resp.text();
    const re = /<img[^\u003e]+src="([^"]+)"[^\u003e]*alt="([^"]*)"[^\u003e]*>/gi;
    let match;
    while ((match = re.exec(html))) {
      const [, src, alt] = match;
      const lowAlt = alt.toLowerCase();
      const lowUrl = src.toLowerCase();
      if (
        (lowAlt.includes(name.toLowerCase()) && /portrait|photo|gravure|illustration|par/.test(lowAlt)) ||
        /portrait/.test(lowUrl)
      ) {
        return { url: src, alt: htmlDecode(alt) };
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function* paginatePosts(env: Env, since?: string): AsyncGenerator<WpPost> {
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const params: Record<string, string> = { per_page: "100", page: String(page), embed: "true" };
    if (since) params.after = since;
    const data = await fetchFromWP(env, "/wp-json/wp/v2/posts", params) as WpPost[];
    if (!Array.isArray(data) || data.length === 0) break;
    totalPages = data.length === 100 ? page + 1 : page;
    for (const p of data) yield p;
    page++;
  }
}

async function* paginateTerms(env: Env, taxonomy: string): AsyncGenerator<WpTerm> {
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const data = await fetchFromWP(env, `/wp-json/wp/v2/${taxonomy}`, {
      per_page: "50",
      page: String(page),
      hide_empty: "true",
      _fields: "id,slug,name,description,count",
    }) as WpTerm[];
    if (!Array.isArray(data) || data.length === 0) break;
    totalPages = data.length === 50 ? page + 1 : page;
    for (const t of data) yield t;
    page++;
  }
}

async function getSyncState(env: Env, key: string, defaultValue: string): Promise<string> {
  const row = await env.DB.prepare("SELECT value FROM sync_state WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? defaultValue;
}

async function setSyncState(env: Env, key: string, value: string) {
  await env.DB.prepare("INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')").bind(key, value).run();
}

export async function getTrackContext(env: Env, trackId: number): Promise<{ bookSlug: string; voiceSlug: string; order: number; trackSlug: string; url: string } | null> {
  const track = await env.DB.prepare(
    `SELECT t.id, t.book_id, t.slug, t.title, t.url, t."order", b.slug as book_slug
     FROM tracks t JOIN books b ON t.book_id = b.id WHERE t.id = ?`
  ).bind(trackId).first<{ book_id: number; slug: string; title: string; url: string; order: number; book_slug: string }>();
  if (!track) return null;

  const voice = await env.DB.prepare(
    `SELECT v.slug as voice_slug FROM book_voices bv JOIN voices v ON bv.voice_id = v.id WHERE bv.book_id = ? LIMIT 1`
  ).bind(track.book_id).first<{ voice_slug: string }>();

  return {
    bookSlug: track.book_slug,
    voiceSlug: voice?.voice_slug || "unknown",
    order: track.order,
    trackSlug: normalizeSlug(track.slug),
    url: track.url,
  };
}

const SYNC_PAGE_SIZE = 5;

async function syncDatabase(env: Env, page: number, since?: string): Promise<{ page: number; processed: number; has_more: boolean; total_books: number; total_authors: number }> {
  const params: Record<string, string> = { per_page: String(SYNC_PAGE_SIZE), page: String(page), embed: "true" };
  if (since) params.after = since;
  const posts = await fetchFromWP(env, "/wp-json/wp/v2/posts", params) as WpPost[];
  if (!Array.isArray(posts) || posts.length === 0) {
    await env.KV.put("last_sync_at", new Date().toISOString());
    const totals = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM books) as books, (SELECT COUNT(*) FROM authors) as authors").first<{ books: number; authors: number }>();
    return { page, processed: 0, has_more: false, total_books: totals?.books ?? 0, total_authors: totals?.authors ?? 0 };
  }

  await processBookBatch(env, posts);

  const hasMore = posts.length === SYNC_PAGE_SIZE;
  if (!hasMore) {
    await env.KV.put("last_sync_at", new Date().toISOString());
  }

  const totals = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM books) as books, (SELECT COUNT(*) FROM authors) as authors").first<{ books: number; authors: number }>();
  return { page, processed: posts.length, has_more: hasMore, total_books: totals?.books ?? 0, total_authors: totals?.authors ?? 0 };
}

async function syncAllTerms(env: Env, resume = false): Promise<{ taxonomies: string[]; authors: number; completed: boolean }> {
  const taxonomies = Object.entries(TAXONOMY_MAP);
  let authorCount = 0;

  const startIndex = resume ? Number(await getSyncState(env, "terms_index", "0")) : 0;
  for (let i = startIndex; i < taxonomies.length; i++) {
    const [wpTax, _table] = taxonomies[i];
    const startPage = resume ? Number(await getSyncState(env, `terms_page_${wpTax}`, "1")) : 1;
    let page = startPage;
    let totalPages = 1;
    while (page <= totalPages) {
      const data = await fetchFromWP(env, `/wp-json/wp/v2/${wpTax}`, {
        per_page: "50",
        page: String(page),
        hide_empty: "true",
        _fields: "id,slug,name,description,count",
      }) as WpTerm[];
      if (!Array.isArray(data) || data.length === 0) break;
      for (const term of data) {
        await upsertTerm(env, term, wpTax);
        if (wpTax === "auteur") authorCount++;
      }
      totalPages = data.length === 50 ? page + 1 : page;
      await setSyncState(env, `terms_page_${wpTax}`, String(page));
      page++;
    }
    await setSyncState(env, "terms_index", String(i + 1));
  }

  await setSyncState(env, "terms_index", "0");
  for (const [wpTax] of taxonomies) {
    await setSyncState(env, `terms_page_${wpTax}`, "1");
  }

  return { taxonomies: taxonomies.map(([k]) => k), authors: authorCount, completed: true };
}

async function processBookBatch(env: Env, posts: WpPost[]) {
  const db = env.DB;
  const promises = posts.map(async (post) => {
    const tracks = await fetchTracksForPost(env, post);
    const slug = normalizeSlug(post.slug);
    const metaDurationSec = msToSec(post.meta?.duration ?? 0);
    const tracksDuration = tracks.reduce((s, t) => s + (t.media_details?.length ?? 0), 0);
    const durationTotal = metaDurationSec || tracksDuration;
    const cover = extractCover(post);

    await db
      .prepare(
        `INSERT INTO books (id, slug, title, excerpt, content, cover_url, duration_total, published_at, modified_at, legacy_url, views, like_count, comment_count, download_url, text_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           slug=excluded.slug, title=excluded.title, excerpt=excluded.excerpt, content=excluded.content,
           cover_url=excluded.cover_url, duration_total=excluded.duration_total, published_at=excluded.published_at,
           modified_at=excluded.modified_at, legacy_url=excluded.legacy_url, views=excluded.views,
           like_count=excluded.like_count, comment_count=excluded.comment_count, download_url=excluded.download_url,
           text_url=excluded.text_url, updated_at=datetime('now')`
      )
      .bind(
        post.id,
        slug,
        htmlDecode(post.title.rendered),
        htmlDecode(post.excerpt.rendered.replace(/<[^>]+>/g, "").trim()),
        post.content.rendered,
        cover?.url ?? null,
        durationTotal,
        post.date_gmt,
        post.modified_gmt,
        post.link,
        post.meta?.["post-count-all"] ?? 0,
        post.meta?.like_count ?? 0,
        0,
        post.meta?.download_url || null,
        extractTextUrl(post.content.rendered) || null
      )
      .run();

    await db.prepare("DELETE FROM tracks WHERE book_id = ?").bind(post.id).run();
    for (const t of tracks) {
      await db
        .prepare(
          `INSERT INTO tracks (id, book_id, slug, title, url, duration, size, \"order\") VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET book_id=excluded.book_id, slug=excluded.slug, title=excluded.title, url=excluded.url, duration=excluded.duration, size=excluded.size, \"order\"=excluded.\"order\"`
        )
        .bind(
          t.id,
          post.id,
          normalizeSlug(t.slug),
          htmlDecode(t.title.rendered),
          t.source_url,
          t.media_details?.length ?? 0,
          t.media_details?.filesize ?? 0,
          t.media_details?.menu_order ?? 0
        )
        .run();
    }

    await updateRelationships(env, post);
  });
  await Promise.all(promises);
}

function extractTextUrl(content: string): string | undefined {
  const match = content.match(/href="(https?:\/\/[^"]*(?:wikisource|gutenberg|ebooks|bnf|gallica)[^"]*)"/i);
  return match?.[1];
}

async function updateRelationships(env: Env, post: WpPost) {
  const db = env.DB;
  const bookId = post.id;
  const rels = {
    book_authors: termMap(post, "auteur"),
    book_voices: termMap(post, "voix"),
    book_genres: termMap(post, "genre_livre"),
    book_periods: termMap(post, "periode"),
    book_regions: termMap(post, "region"),
    book_licences: termMap(post, "licence"),
  };
  for (const [table, terms] of Object.entries(rels)) {
    await db.prepare(`DELETE FROM ${table} WHERE book_id = ?`).bind(bookId).run();
    for (const term of terms) {
      const col = table.replace("book_", "") + "_id";
      await db.prepare(`INSERT OR IGNORE INTO ${table} (book_id, ${col}) VALUES (?, ?)`).bind(bookId, term.id).run();
    }
  }
}

async function upsertTerm(env: Env, term: WpTerm, wpTax: string, fetchPortrait = true) {
  const db = env.DB;
  const table = TAXONOMY_MAP[wpTax];
  let portrait = { url: null as string | null, alt: null as string | null };
  if (wpTax === "auteur" && fetchPortrait) {
    const p = await fetchAuthorPortrait(normalizeSlug(term.slug), term.name);
    if (p) portrait = { url: p.url, alt: p.alt };
  }
  await db
    .prepare(
      `INSERT INTO ${table} (id, slug, name, description, count, portrait_url, portrait_alt) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name, description=excluded.description, count=excluded.count, portrait_url=excluded.portrait_url, portrait_alt=excluded.portrait_alt`
    )
    .bind(term.id, normalizeSlug(term.slug), htmlDecode(term.name), term.description || null, term.count || 0, portrait.url, portrait.alt)
    .run();
}

async function proxyWpRequest(request: IRequest, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const wpPath = url.pathname.replace("/wp", "/wp-json");
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    if (k !== "refresh") params[k] = v;
  });

  const wpUrl = new URL(`${env.WP_API_BASE}${wpPath}`);
  for (const [k, v] of Object.entries(params)) wpUrl.searchParams.set(k, v);
  const resp = await fetch(wpUrl.toString(), { headers: { accept: "application/json" } });
  if (!resp.ok) throw new Error(`WP API ${resp.status} ${wpUrl.toString()}`);
  const data = await resp.json();
  const extraHeaders: Record<string, string> = {};
  for (const h of ["x-wp-total", "x-wp-totalpages"]) {
    const val = resp.headers.get(h);
    if (val) extraHeaders[h] = val;
  }
  return jsonResponse(data, 200, extraHeaders);
}

async function healthCheck(env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare("SELECT COUNT(*) as books FROM books").first<{ books: number }>();
    const lastSync = await env.KV.get("last_sync_at");
    const booksPage = await getSyncState(env, "books_page", "1");
    const termsIndex = await getSyncState(env, "terms_index", "0");
    return jsonResponse({
      status: "ok",
      books: result?.books ?? 0,
      last_sync_at: lastSync,
      sync_state: { books_page: Number(booksPage), terms_index: Number(termsIndex) },
    });
  } catch (e) {
    return jsonResponse({ status: "error", error: String(e) }, 500);
  }
}

async function runScheduledSync(env: Env) {
  // Process up to 20 book pages per scheduled run to stay within Worker limits.
  let page = Math.max(1, Number(await getSyncState(env, "books_page", "1")));
  let remaining = 20;
  while (remaining-- > 0) {
    const result = await syncDatabase(env, page);
    if (!result.has_more) {
      await setSyncState(env, "books_page", "1");
      await env.KV.put("last_sync_at", new Date().toISOString());
      break;
    }
    page = page + 1;
    await setSyncState(env, "books_page", String(page));
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const router = Router();
    router.get("/admin/health", async () => healthCheck(env));
    router.post("/admin/sync", async (req) => {
      const auth = req.headers.get("authorization") || "";
      if (!auth.startsWith("Bearer ") || auth.slice(7) !== env.SYNC_SECRET) {
        return jsonResponse({ error: "unauthorized" }, 401);
      }
      const url = new URL(req.url);
      const mode = url.searchParams.get("mode") || "books";
      const since = url.searchParams.get("since") || undefined;

      if (mode === "terms") {
        const resumeTerms = url.searchParams.get("resume") === "true";
        const result = await syncAllTerms(env, resumeTerms);
        return jsonResponse({ ok: true, mode: "terms", ...result });
      }

      const resume = url.searchParams.get("resume") === "true";
      const full = url.searchParams.get("full") === "true";
      if (full) {
        await setSyncState(env, "books_page", "1");
        await setSyncState(env, "terms_index", "0");
      }
      const page = resume
        ? Math.max(1, Number(await getSyncState(env, "books_page", "1")))
        : Math.max(1, Number(url.searchParams.get("page") || "1"));
      const result = await syncDatabase(env, page, since);
      if (result.has_more) {
        await setSyncState(env, "books_page", String(page + 1));
      } else {
        await setSyncState(env, "books_page", "1");
        await env.KV.put("last_sync_at", new Date().toISOString());
      }
      return jsonResponse({ ok: true, ...result });
    });
    router.get("/wp/*", async (req) => proxyWpRequest(req, env));
    router.get("/api/tracks", async (req) => {
      const url = new URL(req.url);
      const missingB2 = url.searchParams.get("missing_b2") === "true";
      const rawLimit = Number(url.searchParams.get("limit") || "100");
      const limit = Math.min(500, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 100);
      if (!missingB2) return jsonResponse({ error: "only missing_b2=true supported" }, 400);

      const rows = await env.DB.prepare(
        `SELECT t.id, t.book_id, t.slug, t.url, t."order", b.slug AS book_slug,
                COALESCE(MIN(v.slug), 'unknown') AS voice_slug
         FROM tracks t
         JOIN books b ON t.book_id = b.id
         LEFT JOIN book_voices bv ON bv.book_id = t.book_id
         LEFT JOIN voices v ON v.id = bv.voice_id
         WHERE t.b2_url IS NULL AND t.url LIKE 'http%'
         GROUP BY t.id
         ORDER BY t.book_id, t.id
         LIMIT ?`
      ).bind(limit).all<{ id: number; book_id: number; slug: string; url: string; order: number; book_slug: string; voice_slug: string }>();

      const tracks = (rows.results || []).map((t) => ({
        id: t.id,
        book_id: t.book_id,
        book_slug: t.book_slug,
        voice_slug: t.voice_slug,
        order: t.order,
        track_slug: normalizeSlug(t.slug),
        url: t.url,
      }));

      return jsonResponse({ tracks });
    });
    router.all("*", () => jsonResponse({ error: "not found" }, 404));

    return router.fetch(request).catch((e: Error) => jsonResponse({ error: e.message }, 500));
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledSync(env));
  },
};
