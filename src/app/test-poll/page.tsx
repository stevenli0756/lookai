"use client"

import { useState, useEffect, useRef } from "react"

export default function TestPollPage() {
  const [generationId, setGenerationId] = useState("")
  const [polling, setPolling] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const addLog = (msg: string) =>
    setLog((prev) => [`${new Date().toISOString().slice(11, 19)} ${msg}`, ...prev])

  const poll = async (id: string) => {
    const res = await fetch(`/api/jobs/${id}`)
    const data = await res.json()
    addLog(`status=${data.status} credits=${data.creditsRemaining ?? "?"}`)

    if (data.status === "complete") {
      setResultUrl(data.resultReadUrl)
      stopPolling()
      addLog("Done!")
    } else if (data.status === "failed") {
      addLog(`Failed: ${data.errorMessage}`)
      stopPolling()
    }
  }

  const stopPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPolling(false)
  }

  const startPolling = () => {
    if (!generationId.trim()) return
    setLog([])
    setResultUrl(null)
    setPolling(true)
    addLog("Starting poll…")
    poll(generationId)
    intervalRef.current = setInterval(() => poll(generationId), 3000)
  }

  useEffect(() => () => stopPolling(), [])

  return (
    <div className="p-8 max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Poll Test</h1>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Paste generationId"
          value={generationId}
          onChange={(e) => setGenerationId(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
        />
        <button
          onClick={polling ? stopPolling : startPolling}
          className="px-4 py-2 bg-black text-white text-sm rounded-lg"
        >
          {polling ? "Stop" : "Start polling"}
        </button>
      </div>
      {resultUrl && (
        <img src={resultUrl} alt="Result" className="rounded-lg border w-full" />
      )}
      <div className="font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
        {log.map((line, i) => <p key={i}>{line}</p>)}
      </div>
    </div>
  )
}
