"use client"

import type { ChangeEvent, DragEvent } from "react"

export type UploadedImage = {
  fileName: string
  previewUrl: string
  objectKey: string
}

export type UploadPhase = "idle" | "uploading" | "uploaded" | "error"

type ImageUploaderProps = {
  id: string
  label: string
  description: string
  image: UploadedImage | null
  phase: UploadPhase
  error: string | null
  disabled?: boolean
  onFileSelected: (file: File) => void
}

export default function ImageUploader({
  id,
  label,
  description,
  image,
  phase,
  error,
  disabled = false,
  onFileSelected,
}: ImageUploaderProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (file) {
      onFileSelected(file)
    }
  }

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    if (disabled) {
      return
    }

    event.preventDefault()
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    if (disabled) {
      return
    }

    event.preventDefault()
    const file = event.dataTransfer.files[0]

    if (file) {
      onFileSelected(file)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={id} className="block text-sm font-semibold text-zinc-950">
          {label}
        </label>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      <label
        htmlFor={id}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="group relative flex aspect-[4/5] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50 transition hover:border-zinc-950 hover:bg-white"
      >
        {image ? (
          <span
            aria-label={`${label} preview`}
            className="absolute inset-0 bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${image.previewUrl})` }}
          />
        ) : (
          <span className="px-6 text-center text-sm font-medium text-zinc-500">
            Choose a JPEG, PNG, or WebP image
          </span>
        )}

        <span className="absolute inset-x-0 bottom-0 bg-zinc-950/75 px-4 py-3 text-sm font-medium text-white opacity-0 transition group-hover:opacity-100">
          {image ? "Replace image" : "Upload image"}
        </span>

        {phase === "uploading" && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm font-medium text-zinc-900">
            Uploading...
          </span>
        )}
      </label>

      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={handleChange}
        className="sr-only"
      />

      <div className="min-h-5 text-sm">
        {phase === "uploaded" && image && (
          <p className="truncate text-zinc-500">{image.fileName}</p>
        )}
        {error && <p className="text-red-600">{error}</p>}
      </div>
    </div>
  )
}
