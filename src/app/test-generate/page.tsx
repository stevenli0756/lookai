"use client"

import { useState } from "react"

async function uploadFile(file: File): Promise<string> {
  const presignRes = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, contentLength: file.size }),
  })
  if (!presignRes.ok) {
    const err = await presignRes.json()
    throw new Error(err.error ?? "Upload presign failed")
  }
  const { uploadUrl, objectKey } = await presignRes.json()
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  })
  if (!putRes.ok) throw new Error(`R2 PUT failed: ${putRes.status}`)
  return objectKey
}

export default function TestGeneratePage() {
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [garmentFile, setGarmentFile] = useState<File | null>(null)
  const [status, setStatus] = useState("")
  const [result, setResult] = useState<{ generationId: string; predictionId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRun = async () => {
    if (!modelFile || !garmentFile) return
    setStatus("Uploading model image…")
    setResult(null)
    setError(null)

    try {
      const modelObjectKey = await uploadFile(modelFile)
      setStatus("Uploading garment image…")
      const garmentObjectKey = await uploadFile(garmentFile)
      setStatus("Calling /api/generate…")

      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelObjectKey, garmentObjectKey }),
      })
      const genData = await genRes.json()
      if (!genRes.ok) {
        setError(genData.error ?? "Generate failed")
        setStatus("")
        return
      }

      setResult(genData)
      setStatus("Done! Copy the generationId and paste it into /test-poll")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setStatus("")
    }
  }

  return (
    <div className="p-8 max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Generate Test</h1>
      <div>
        <label className="block text-sm font-medium mb-1">Model image</label>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setModelFile(e.target.files?.[0] ?? null)} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Garment image</label>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setGarmentFile(e.target.files?.[0] ?? null)} />
      </div>
      <button
        onClick={handleRun}
        disabled={!modelFile || !garmentFile}
        className="px-4 py-2 bg-black text-white text-sm rounded-lg disabled:opacity-40"
      >
        Run generation
      </button>
      {status && <p className="text-sm text-gray-600">{status}</p>}
      {error && <p className="text-sm text-red-600">Error: {error}</p>}
      {result && (
        <div className="text-sm space-y-1 bg-gray-50 p-4 rounded-lg font-mono">
          <p><strong>generationId:</strong> {result.generationId}</p>
          <p><strong>predictionId:</strong> {result.predictionId}</p>
        </div>
      )}
    </div>
  )
}
