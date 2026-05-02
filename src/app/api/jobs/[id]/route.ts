import { NextResponse, type NextRequest } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getStatus, mapFashnStatus } from "@/lib/fashn"
import { copyExternalUrlToR2, getPresignedGetUrl } from "@/lib/r2"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: generationId } = await params
  const service = createServiceClient()

  // 2. Load generation row
  const { data: generation, error: fetchError } = await service
    .from("generations")
    .select("*")
    .eq("id", generationId)
    .single()

  if (fetchError || !generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 })
  }

  // 3. Ownership check
  if (generation.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Helper: read current credits for response
  const getCredits = async (): Promise<number> => {
    const { data } = await service
      .from("profiles")
      .select("credits_remaining")
      .eq("id", user.id)
      .single()
    return data?.credits_remaining ?? 0
  }

  // 4. Terminal state: complete — return cached result, no FASHN call
  if (generation.status === "complete") {
    const [resultReadUrl, creditsRemaining] = await Promise.all([
      getPresignedGetUrl(generation.result_image_url),
      getCredits(),
    ])
    return NextResponse.json({
      status: "complete",
      resultObjectKey: generation.result_image_url,
      resultReadUrl,
      creditsRemaining,
    })
  }

  // 5. Terminal state: failed — return cached failure, no FASHN call
  if (generation.status === "failed") {
    return NextResponse.json({
      status: "failed",
      errorMessage: generation.error_message,
      creditsRemaining: await getCredits(),
    })
  }

  // 6. Pending: poll FASHN for current status
  if (!generation.fashn_prediction_id) {
    // Should not happen in normal flow — Phase 4 logs but doesn't fail if this UPDATE is missed
    console.error("[jobs] Pending generation has no fashn_prediction_id:", generationId)
    return NextResponse.json({ error: "Generation state corrupted" }, { status: 500 })
  }

  let fashnResult: Awaited<ReturnType<typeof getStatus>>
  try {
    fashnResult = await getStatus(generation.fashn_prediction_id)
  } catch (err) {
    console.error("[jobs] getStatus failed:", err)
    return NextResponse.json({ error: "Failed to check generation status" }, { status: 502 })
  }

  const mappedStatus = mapFashnStatus(fashnResult.status)

  // Still in flight
  if (mappedStatus === "pending") {
    return NextResponse.json({
      status: "pending",
      creditsRemaining: await getCredits(),
    })
  }

  // FASHN completed — copy result to R2 and mark complete
  if (mappedStatus === "complete") {
    const resultUrl = fashnResult.output?.[0]
    if (!resultUrl) {
      console.error("[jobs] FASHN returned completed but output is empty:", fashnResult)
      // Treat as failure
      await markFailed(service, user.id, generationId, "Generation produced no output.")
      return NextResponse.json({
        status: "failed",
        errorMessage: "Generation produced no output. Your credit has been refunded.",
        creditsRemaining: await getCredits(),
      })
    }

    // Result key is deterministic: crash-resume just overwrites the same R2 object.
    // This makes the copy + DB update sequence idempotent across retries.
    const resultObjectKey = `users/${user.id}/results/${generationId}.jpg`

    try {
      await copyExternalUrlToR2(resultUrl, resultObjectKey)
    } catch (err) {
      console.error("[jobs] Failed to copy result to R2:", err)
      return NextResponse.json({ error: "Failed to store result" }, { status: 500 })
    }

    // Single UPDATE: status, result key, and completed_at in one write (atomic transition)
    await service
      .from("generations")
      .update({
        status: "complete",
        result_image_url: resultObjectKey,
        completed_at: new Date().toISOString(),
      })
      .eq("id", generationId)

    const [resultReadUrl, creditsRemaining] = await Promise.all([
      getPresignedGetUrl(resultObjectKey),
      getCredits(),
    ])

    return NextResponse.json({
      status: "complete",
      resultObjectKey,
      resultReadUrl,
      creditsRemaining,
    })
  }

  // FASHN failed — refund credit and mark failed
  console.error("[jobs] FASHN generation failed:", fashnResult.error)
  await markFailed(service, user.id, generationId, "Generation failed. Your credit has been refunded.")

  return NextResponse.json({
    status: "failed",
    errorMessage: "Generation failed. Your credit has been refunded.",
    creditsRemaining: await getCredits(),
  })
}

async function markFailed(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  generationId: string,
  errorMessage: string
): Promise<void> {
  const { data: profile } = await service
    .from("profiles")
    .select("credits_remaining")
    .eq("id", userId)
    .single()

  // TODO: wrap refund in RPC for atomicity if abuse becomes an issue.
  await Promise.all([
    service
      .from("profiles")
      .update({ credits_remaining: (profile?.credits_remaining ?? 0) + 1 })
      .eq("id", userId),
    service
      .from("generations")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", generationId),
  ])
}
