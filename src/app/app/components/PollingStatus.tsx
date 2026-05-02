"use client"

import { useEffect, useState } from "react"

type PollingStatusProps = {
  active: boolean
  statusText: string
}

const messages = [
  "Analyzing fit...",
  "Placing garment...",
  "Refining details...",
  "Adjusting lighting...",
  "Almost done...",
]

export default function PollingStatus({ active, statusText }: PollingStatusProps) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    if (!active) {
      return
    }

    const intervalId = setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length)
    }, 3000)

    return () => clearInterval(intervalId)
  }, [active])

  if (!active) {
    return null
  }

  const message = messages[messageIndex] ?? statusText

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 shrink-0">
          <span className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-400 via-violet-500 to-fuchsia-500 opacity-30 animate-ping" />
          <span className="absolute inset-1 rounded-full bg-gradient-to-r from-sky-400 via-violet-500 to-fuchsia-500 animate-pulse" />
          <span className="absolute inset-3 rounded-full bg-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-sky-400 via-violet-500 to-fuchsia-500 animate-[pulse_1.6s_ease-in-out_infinite]" />
          </div>
          <p className="text-sm font-semibold text-zinc-950">{message}</p>
          <p className="mt-1 text-sm text-zinc-500">
            This usually takes under a minute. Keep this tab open while the result finishes.
          </p>
        </div>
      </div>
    </div>
  )
}
