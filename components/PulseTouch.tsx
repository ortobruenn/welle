'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  durationSeconds?: number
  onComplete: () => void
}

export default function PulseTouch({ durationSeconds = 10, onComplete }: Props) {
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  const startHold = () => {
    setHolding(true)
    startTimeRef.current = Date.now()
    if (navigator.vibrate) navigator.vibrate(30)

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const ratio = Math.min(elapsed / (durationSeconds * 1000), 1)
      setProgress(ratio)

      if (ratio >= 1) {
        clearInterval(timerRef.current!)
        if (navigator.vibrate) navigator.vibrate([60, 40, 100])
        onComplete()
      }
    }, 50)
  }

  const cancelHold = () => {
    if (progress < 1) {
      setHolding(false)
      setProgress(0)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center gap-10 select-none touch-none w-full">
      <div
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        className="relative w-44 h-44 rounded-full flex items-center justify-center cursor-pointer transition-transform duration-300 active:scale-95"
        style={{
          border: '1.5px solid rgba(200, 160, 101, 0.3)',
          background: holding ? 'rgba(200, 160, 101, 0.08)' : 'transparent',
        }}
      >
        {/* Animated fill circle */}
        <div
          className="absolute rounded-full transition-all"
          style={{
            width: `${progress * 100}%`,
            height: `${progress * 100}%`,
            background: 'rgba(200, 160, 101, 0.25)',
          }}
        />

        <div
          className={`font-display text-4xl transition-opacity duration-500 ${
            holding ? 'scale-110 text-[#c8a065]' : 'text-[#6b6560]'
          }`}
        >
          ∿
        </div>
      </div>

      <p className="text-xs tracking-[0.25em] uppercase text-center text-[#6b6560]">
        {progress >= 1
          ? 'Resonanz erfasst'
          : holding
          ? `${Math.ceil((1 - progress) * durationSeconds)}s halten...`
          : `${durationSeconds} Sekunden berühren & halten`}
      </p>
    </div>
  )
}
