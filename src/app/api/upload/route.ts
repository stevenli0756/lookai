import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPresignedPutUrl, getPresignedGetUrl } from "@/lib/r2"
import { env } from "@/env"
import crypto from "crypto"

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
}
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { contentType?: string; contentLength?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { contentType, contentLength } = body

  if (contentType === "image/heic" || contentType === "image/heif") {
    return NextResponse.json(
      { error: "HEIC files aren't supported. Please convert to JPG in your phone settings first." },
      { status: 415 }
    )
  }

  if (!contentType || !(contentType in ALLOWED_TYPES)) {
    return NextResponse.json(
      { error: "Unsupported file type. Please upload a JPEG, PNG, or WebP image." },
      { status: 415 }
    )
  }

  if (!contentLength || contentLength <= 0) {
    return NextResponse.json({ error: "Missing file size" }, { status: 400 })
  }

  if (contentLength > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10MB." },
      { status: 413 }
    )
  }

  const ext = ALLOWED_TYPES[contentType]
  const objectKey = `users/${user.id}/uploads/${Date.now()}-${crypto.randomUUID()}${ext}`

  const [uploadUrl, readUrl] = await Promise.all([
    getPresignedPutUrl(objectKey, contentType, 15 * 60),
    getPresignedGetUrl(objectKey, 60 * 60),
  ])

  return NextResponse.json({ uploadUrl, objectKey, readUrl })
}
