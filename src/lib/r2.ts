import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { env } from "@/env"

const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
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

  // response.body is a Web ReadableStream — AWS SDK v3 passes it directly to the HTTP
  // layer without buffering. ContentLength from CDN headers lets R2 size the upload
  // without consuming the stream. R2 also accepts chunked transfer if it's absent.
  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey,
      Body: response.body as ReadableStream,
      ContentType: contentType,
      ...(contentLength ? { ContentLength: Number(contentLength) } : {}),
    })
  )
}
