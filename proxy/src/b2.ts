import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Env } from "./index";

const B2_ENDPOINT = "https://s3.eu-central-003.backblazeb2.com";
const B2_BUCKET = "litteratureaudio-media";
const CDN_BASE = "https://f003.backblazeb2.com";

export function b2Client(env: Env): S3Client {
  return new S3Client({
    region: "eu-central-003",
    endpoint: B2_ENDPOINT,
    credentials: {
      accessKeyId: env.B2_APPLICATION_KEY_ID || "",
      secretAccessKey: env.B2_APPLICATION_KEY || "",
    },
  });
}

export async function uploadToB2(
  env: Env,
  key: string,
  body: ArrayBuffer,
  contentType: string = "audio/mpeg"
): Promise<string> {
  const client = b2Client(env);
  await client.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
      Body: new Uint8Array(body),
      ContentType: contentType,
    })
  );
  return `${CDN_BASE}/file/${B2_BUCKET}/${key}`;
}