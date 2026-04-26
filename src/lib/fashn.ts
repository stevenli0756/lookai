import { env } from "@/env"

const FASHN_BASE = "https://api.fashn.ai/v1"

export type FashnStatus =
  | "in_queue"
  | "starting"
  | "processing"
  | "completed"
  | "failed"

export interface FashnStatusResponse {
  id: string
  status: FashnStatus
  output: string[] | null
  error: { name: string; message: string } | null
}

// Maps FASHN's response.id to our internal predictionId naming
function extractPredictionId(response: { id: string }): string {
  return response.id
}

export async function submitGeneration(
  modelImageUrl: string,
  garmentImageUrl: string
): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  let response: Response
  try {
    response = await fetch(`${FASHN_BASE}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.FASHN_API_KEY}`,
      },
      body: JSON.stringify({
        model_name: "tryon-v1.6",
        inputs: {
          model_image: modelImageUrl,
          garment_image: garmentImageUrl,
          garment_photo_type: "flat-lay",
          category: "auto",
        },
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`FASHN /run failed (${response.status}): ${body}`)
  }

  const data = await response.json()
  if (data.error) {
    throw new Error(`FASHN error: ${JSON.stringify(data.error)}`)
  }

  return extractPredictionId(data)
}

export async function getStatus(predictionId: string): Promise<FashnStatusResponse> {
  const response = await fetch(`${FASHN_BASE}/status/${predictionId}`, {
    headers: { Authorization: `Bearer ${env.FASHN_API_KEY}` },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`FASHN /status failed (${response.status}): ${body}`)
  }

  return response.json()
}
