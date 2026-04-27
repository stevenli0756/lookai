import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { Readable } from "stream"
import { env } from "@/env"

const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  // R2 accepts unsigned payload; without this the SDK tries to hash the body
  // for SigV4, which requires reading a streaming body twice (impossible).
  requestChecksumCalculation: "when_required",
})

export async function getPresignedPutUrl(
  objectKey: string,
  contentType: string,
  expiresIn = 15 * 60
): Promise<string> {
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: objectKey, ContentType: contentType }),
    { expiresIn }
  )
}

export async function getPresignedGetUrl(
  objectKey: string,
  expiresIn = 60 * 60
): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: objectKey }),
    { expiresIn }
  )
}

export async function copyExternalUrlToR2(
  sourceUrl: string,
  objectKey: string,
): Promise<void> {
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`Failed to fetch source URL: ${response.status}`)

  const contentType = response.headers.get("content-type") ?? "image/jpeg"
  const contentLength = response.headers.get("content-length")

  // fetch() returns a Web ReadableStream; AWS SDK v3 on Node.js requires a Node.js
  // Readable. Readable.fromWeb() bridges the two without buffering into memory.
  const nodeStream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey,
      Body: nodeStream,
      ContentType: contentType,
      ...(contentLength ? { ContentLength: Number(contentLength) } : {}),
    })
  )
}
