import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const WORKER_URL = process.env.WORKER_URL || "https://litteratureaudio-cache.elarif-ahamada.workers.dev";
const SYNC_SECRET = process.env.SYNC_SECRET || "";
const B2_KEY_ID = process.env.B2_APPLICATION_KEY_ID || "";
const B2_KEY = process.env.B2_APPLICATION_KEY || "";
const B2_REGION = process.env.B2_BUCKET_REGION || "eu-central-003";
const B2_BUCKET = "litteratureaudio-media";
const CDN_BASE = "https://f003.backblazeb2.com";
const BATCH_SIZE = 500;
const MAX_RUNTIME_MS = Number(process.env.MAX_RUNTIME_MS || "14400000"); // 4h default

function normalizeSlug(slug: string): string {
  return slug
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildB2Key(bookSlug: string, voiceSlug: string, order: number, trackSlug: string): string {
  const padded = String(order + 1).padStart(2, "0");
  const truncated = trackSlug.slice(0, 60);
  return `mp3/${normalizeSlug(bookSlug)}/${normalizeSlug(voiceSlug) || "unknown"}/${padded}-${normalizeSlug(truncated)}.mp3`;
}

async function fetchJson(url: string, init?: RequestInit) {
  const resp = await fetch(url, init);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${url}`);
  return resp.json();
}

async function main() {
  if (!SYNC_SECRET) throw new Error("SYNC_SECRET required");
  if (!B2_KEY_ID || !B2_KEY) throw new Error("B2 credentials required");

  const s3 = new S3Client({
    region: B2_REGION,
    endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
    credentials: { accessKeyId: B2_KEY_ID, secretAccessKey: B2_KEY },
  });

  const startedAt = Date.now();
  let totalUploaded = 0;
  let batch = 0;
  while (true) {
    if (Date.now() - startedAt > MAX_RUNTIME_MS) {
      console.log(`⏱ Runtime limit reached (${Math.round((Date.now() - startedAt) / 1000)}s). Uploaded ${totalUploaded} tracks. Resumes next run.`);
      break;
    }
    batch++;
    const data = await fetchJson(`${WORKER_URL}/api/tracks?missing_b2=true&limit=${BATCH_SIZE}`);
    const tracks = (data as { tracks: Array<{ id: number; book_slug: string; voice_slug: string; order: number; track_slug: string; url: string }> }).tracks;
    if (!tracks.length) {
      console.log(`✓ No more tracks to mirror. Total uploaded: ${totalUploaded}`);
      break;
    }
    console.log(`Batch ${batch}: ${tracks.length} tracks to upload`);
    for (const t of tracks) {
      try {
        const mp3Resp = await fetch(t.url, { headers: { "user-agent": "LitteratureaudioBot/1.0", referer: "https://www.litteratureaudio.com/" } });
        if (!mp3Resp.ok) { console.error(`  ✗ download fail ${t.id}: ${mp3Resp.status}`); continue; }
        const body = await mp3Resp.arrayBuffer();
        const key = buildB2Key(t.book_slug, t.voice_slug, t.order, t.track_slug);
        await s3.send(new PutObjectCommand({ Bucket: B2_BUCKET, Key: key, Body: new Uint8Array(body), ContentType: "audio/mpeg" }));
        const cdnUrl = `${CDN_BASE}/file/${B2_BUCKET}/${key}`;
        await fetchJson(`${WORKER_URL}/admin/tracks/${t.id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SYNC_SECRET}`, "Content-Type": "application/json" },
          body: JSON.stringify({ b2_url: cdnUrl }),
        });
        totalUploaded++;
        if (totalUploaded % 50 === 0) console.log(`  ${totalUploaded} uploaded…`);
      } catch (e) {
        console.error(`  ✗ track ${t.id}: ${String(e)}`);
      }
    }
  }
  console.log(`Done. ${totalUploaded} tracks uploaded.`);
}

main().catch((e) => { console.error(e); process.exit(1); });