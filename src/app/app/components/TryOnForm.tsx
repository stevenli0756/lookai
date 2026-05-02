"use client"

import { useEffect, useRef, useState } from "react"
import ImageUploader, {
  type UploadedImage,
  type UploadPhase,
} from "./ImageUploader"
import PollingStatus from "./PollingStatus"
import ResultDisplay from "./ResultDisplay"

type Slot = "model" | "garment"
type GenerationStatus = "idle" | "starting" | "polling" | "complete" | "failed"

type SlotState = {
  image: UploadedImage | null
  phase: UploadPhase
  error: string | null
}

type UploadResponse = {
  uploadUrl: string
  objectKey: string
  readUrl: string
}

type GenerateResponse = {
  generationId: string
  predictionId: string
}

type JobResponse = {
  status: "pending" | "complete" | "failed"
  resultReadUrl?: string
  creditsRemaining?: number
  errorMessage?: string
}

type ApiErrorResponse = {
  error?: string
}

type TryOnFormProps = {
  initialCredits: number
}

const MAX_SIZE = 10 * 1024 * 1024
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

const emptySlot = (): SlotState => ({
  image: null,
  phase: "idle",
  error: null,
})

export default function TryOnForm({ initialCredits }: TryOnFormProps) {
  const [model, setModel] = useState<SlotState>(emptySlot)
  const [garment, setGarment] = useState<SlotState>(emptySlot)
  const [creditsRemaining, setCreditsRemaining] = useState(initialCredits)
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>("idle")
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const previewUrls = useRef<string[]>([])

  useEffect(() => {
    return () => {
      for (const url of previewUrls.current) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  useEffect(() => {
    if (!generationId || generationStatus !== "polling") {
      return
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${generationId}`)
        const body = await readJson<JobResponse & ApiErrorResponse>(response)

        if (!response.ok) {
          throw new Error(body.error ?? "Failed to check generation status")
        }

        if (typeof body.creditsRemaining === "number") {
          setCreditsRemaining(body.creditsRemaining)
        }

        if (cancelled) {
          return
        }

        if (body.status === "complete" && body.resultReadUrl) {
          setResultUrl(body.resultReadUrl)
          setGenerationStatus("complete")
          return
        }

        if (body.status === "failed") {
          setFormError(body.errorMessage ?? "Generation failed. Your credit has been refunded.")
          setGenerationStatus("failed")
          return
        }

        timeoutId = setTimeout(poll, 4000)
      } catch (error) {
        if (cancelled) {
          return
        }
        setFormError(error instanceof Error ? error.message : "Failed to check generation status")
        timeoutId = setTimeout(poll, 6000)
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [generationId, generationStatus])

  const handleUpload = async (slot: Slot, file: File) => {
    setFormError(null)
    setSlot(slot, { image: null, phase: "uploading", error: null })

    const validationError = validateFile(file)
    if (validationError) {
      setSlot(slot, { image: null, phase: "error", error: validationError })
      return
    }

    const previewUrl = URL.createObjectURL(file)
    previewUrls.current.push(previewUrl)

    try {
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          contentLength: file.size,
        }),
      })
      const uploadBody = await readJson<UploadResponse & ApiErrorResponse>(uploadResponse)

      if (!uploadResponse.ok) {
        throw new Error(uploadBody.error ?? "Failed to prepare upload")
      }

      const putResponse = await fetch(uploadBody.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })

      if (!putResponse.ok) {
        throw new Error("Upload failed")
      }

      setSlot(slot, {
        image: {
          fileName: file.name,
          previewUrl,
          objectKey: uploadBody.objectKey,
        },
        phase: "uploaded",
        error: null,
      })
    } catch (error) {
      URL.revokeObjectURL(previewUrl)
      previewUrls.current = previewUrls.current.filter((url) => url !== previewUrl)
      setSlot(slot, {
        image: null,
        phase: "error",
        error: error instanceof Error ? error.message : "Upload failed",
      })
    }
  }

  const handleGenerate = async () => {
    setFormError(null)
    setResultUrl(null)

    if (!model.image || !garment.image) {
      setFormError("Upload a model photo and a garment photo before generating.")
      return
    }

    if (creditsRemaining < 1) {
      setFormError("You are out of credits.")
      return
    }

    setGenerationStatus("starting")

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelObjectKey: model.image.objectKey,
          garmentObjectKey: garment.image.objectKey,
        }),
      })
      const body = await readJson<GenerateResponse & ApiErrorResponse>(response)

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to start generation")
      }

      setCreditsRemaining((current) => Math.max(current - 1, 0))
      setGenerationId(body.generationId)
      setGenerationStatus("polling")
    } catch (error) {
      setGenerationStatus("failed")
      setFormError(error instanceof Error ? error.message : "Failed to start generation")
    }
  }

  const handleReset = () => {
    setGenerationId(null)
    setGenerationStatus("idle")
    setResultUrl(null)
    setFormError(null)
  }

  const busy =
    model.phase === "uploading" ||
    garment.phase === "uploading" ||
    generationStatus === "starting" ||
    generationStatus === "polling"
  const ready = Boolean(model.image && garment.image)

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Generate try-on
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Upload a model photo and a garment photo. LookAI will create a
              product-ready on-model image.
            </p>
          </div>
          <div className="rounded-lg bg-zinc-100 px-4 py-3 text-sm">
            <span className="text-zinc-500">Credits</span>{" "}
            <span className="font-semibold text-zinc-950">{creditsRemaining}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <ImageUploader
            id="model-photo"
            label="Model photo"
            description="Use a clear, front-facing model image."
            image={model.image}
            phase={model.phase}
            error={model.error}
            disabled={busy}
            onFileSelected={(file) => void handleUpload("model", file)}
          />
          <ImageUploader
            id="garment-photo"
            label="Garment photo"
            description="Use a flat-lay or clean product image."
            image={garment.image}
            phase={garment.phase}
            error={garment.error}
            disabled={busy}
            onFileSelected={(file) => void handleUpload("garment", file)}
          />
        </div>

        <div className="mt-6 space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!ready || busy || creditsRemaining < 1}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {generationStatus === "starting" ? "Starting..." : "Generate try-on"}
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <PollingStatus
          active={generationStatus === "starting" || generationStatus === "polling"}
          statusText={generationStatus === "starting" ? "Starting generation" : "Generating image"}
        />
        <ResultDisplay resultUrl={resultUrl} onReset={handleReset} />
      </aside>
    </div>
  )

  function setSlot(slot: Slot, value: SlotState) {
    if (slot === "model") {
      setModel(value)
    } else {
      setGarment(value)
    }
  }
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) {
    if (file.type === "image/heic" || file.type === "image/heif") {
      return "HEIC files are not supported. Convert to JPG first."
    }
    return "Upload a JPEG, PNG, or WebP image."
  }

  if (file.size > MAX_SIZE) {
    return "Maximum file size is 10MB."
  }

  return null
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}
