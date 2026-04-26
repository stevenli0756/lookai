import { NextResponse, type NextRequest } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getPresignedGetUrl } from "@/lib/r2"
import { submitGeneration } from "@/lib/fashn"

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse and validate body
  let body: { modelObjectKey?: string; garmentObjectKey?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { modelObjectKey, garmentObjectKey } = body
  if (!modelObjectKey || !garmentObjectKey) {
    return NextResponse.json(
      { error: "modelObjectKey and garmentObjectKey are required" },
      { status: 400 }
    )
  }

  // 3. Validate R2 key ownership — both keys must belong to this user
  const expectedPrefix = `users/${user.id}/`
  if (
    !modelObjectKey.startsWith(expectedPrefix) ||
    !garmentObjectKey.startsWith(expectedPrefix)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const service = createServiceClient()

  // 4. Concurrent generation check
  const { data: pending } = await service
    .from("generations")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle()

  if (pending) {
    return NextResponse.json(
      { error: "You already have a generation in progress. Please wait for it to complete." },
      { status: 409 }
    )
  }

  // 5. Atomic credit reservation — inserts generation row with status='pending'
  const { data: generationId, error: rpcError } = await service.rpc(
    "reserve_credit_and_create_generation",
    {
      p_user_id: user.id,
      p_model_object_key: modelObjectKey,
      p_garment_object_key: garmentObjectKey,
    }
  )

  if (rpcError) {
    if (rpcError.message.includes("INSUFFICIENT_CREDITS")) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 })
    }
    if (rpcError.message.includes("PROFILE_NOT_FOUND")) {
      return NextResponse.json({ error: "User profile not found" }, { status: 500 })
    }
    console.error("[generate] RPC error:", rpcError)
    return NextResponse.json({ error: "Failed to reserve credit" }, { status: 500 })
  }

  // 6. Generate fresh 1hr presigned readUrls for FASHN
  let modelReadUrl: string
  let garmentReadUrl: string
  try {
    ;[modelReadUrl, garmentReadUrl] = await Promise.all([
      getPresignedGetUrl(modelObjectKey),
      getPresignedGetUrl(garmentObjectKey),
    ])
  } catch (err) {
    console.error("[generate] Failed to generate presigned URLs:", err)
    await refundCredit(service, user.id, generationId, "Internal error preparing images.")
    return NextResponse.json({ error: "Internal error preparing images" }, { status: 500 })
  }

  // 7. Call FASHN /v1/run
  let predictionId: string
  try {
    predictionId = await submitGeneration(modelReadUrl, garmentReadUrl)
  } catch (err) {
    console.error("[generate] FASHN submitGeneration failed:", err)
    await refundCredit(
      service,
      user.id,
      generationId,
      "Generation service unavailable. Your credit has been refunded."
    )
    return NextResponse.json(
      { error: "Generation service unavailable. Your credit has been refunded." },
      { status: 500 }
    )
  }

  // 8. On FASHN success: store prediction_id
  const { error: updateError } = await service
    .from("generations")
    .update({ fashn_prediction_id: predictionId })
    .eq("id", generationId)

  if (updateError) {
    // Generation is live in FASHN — don't refund. Phase 5 polling will recover it.
    console.error("[generate] Failed to update prediction_id:", updateError)
  }

  return NextResponse.json({ generationId, predictionId })
}

async function refundCredit(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  generationId: string,
  errorMessage: string
): Promise<void> {
  // TODO: wrap refund in RPC for atomicity if abuse becomes an issue.
  // Read current credits then increment — slightly racy but acceptable for v0.
  const { data: profile } = await service
    .from("profiles")
    .select("credits_remaining")
    .eq("id", userId)
    .single()

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
