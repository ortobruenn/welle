'use client'

import { useState, useEffect } from 'react'

interface Props {
  durationSeconds?: number
  onComplete: () => void
}

export default function SilenceMoment({ durationSeconds = 20, onComplete }: Props) {
  const [started, setStarted] = useState(false)
  const [remaining, setRemaining] = useState(durationSeconds)

  useEffect(() => {
    if (!started) return

    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(interval)
          if (navigator.vibrate) navigator.vibrate([100, 50, 100])
          onComplete()
          return 0
        }
        return r - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [started, onComplete])

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center gap-8 text-center">
        <p className="text-xs tracking-[0.25em] uppercase text-[#6b6560]">
          Nimm dir {durationSeconds} Sekunden Stille.
        </p>
        <button
          onClick={() => setStarted(true)}
          className="py-3 px-6 border border-[#c8a065] text-xs tracking-[0.25em] uppercase text-[#c8a065] hover:bg-[#c8a065]/10 transition-colors"
        >
          Beginnen
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full border border-[#c8a065]/30 flex items-center justify-center animate-breathe">
        <span className="font-display text-2xl text-[#c8a065]">∿</span>
      </div>
      <p className="font-display text-5xl font-light text-[#e8e4de]">{remaining}</p>
      <p className="text-xs tracking-[0.25em] uppercase text-[#6b6560]">
        Schließe kurz die Augen.
      </p>
    </div>
  )
}
