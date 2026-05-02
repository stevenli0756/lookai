"use client"

import { useState } from "react"

type ResultDisplayProps = {
  resultUrl: string | null
  onReset: () => void
}

export default function ResultDisplay({ resultUrl, onReset }: ResultDisplayProps) {
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  if (!resultUrl) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 px-8 text-center text-sm font-medium text-zinc-500">
        Your generated image will appear here
      </div>
    )
  }

  const handleDownload = async () => {
    setDownloadError(null)
    setDownloading(true)

    try {
      const response = await fetch(resultUrl)
      if (!response.ok) {
        throw new Error("Download failed")
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "lookai-try-on.jpg"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError("Could not download the image. Try opening it in a new tab.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      <a
        href={resultUrl}
        target="_blank"
        rel="noreferrer"
        className="block aspect-[4/5] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
        aria-label="Open generated image in a new tab"
      >
        <span
          className="block h-full w-full bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${resultUrl})` }}
        />
      </a>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? "Downloading..." : "Download"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-50"
        >
          New try-on
        </button>
      </div>

      {downloadError && <p className="text-sm text-red-600">{downloadError}</p>}
    </div>
  )
}
