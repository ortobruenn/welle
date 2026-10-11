'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  durationSeconds?: number
  onComplete: () => void
}

export default function PulseTouch({ durationSeconds = 10, onComplete }: Props) {
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const lastVibrateSec = useRef<number>(0)

  const startHold = (e: React.MouseEvent | React.TouchEvent) => {
    if (completed) return
    e.preventDefault()
    setHolding(true)
    startTimeRef.current = Date.now()
    lastVibrateSec.current = 0
    if (navigator.vibrate) navigator.vibrate(40)

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const ratio = Math.min(elapsed / (durationSeconds * 1000), 1)
      setProgress(ratio)

      // Rhythmic subtle pulse vibration every 2 seconds
      const currentSec = Math.floor(elapsed / 1000)
      if (currentSec > lastVibrateSec.current) {
        lastVibrateSec.current = currentSec
        if (navigator.vibrate) navigator.vibrate(25)
      }

      if (ratio >= 1) {
        clearInterval(timerRef.current!)
        setCompleted(true)
        if (navigator.vibrate) navigator.vibrate([80, 50, 150])
        onComplete()
      }
    }, 40)
  }

  const cancelHold = () => {
    if (completed) return
    setHolding(false)
    setProgress(0)
    if (timerRef.current) clearInterval(timerRef.current)
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
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        className={`relative w-48 h-48 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${
          holding ? 'scale-105' : 'hover:scale-102'
        }`}
        style={{
          border: completed 
            ? '2px solid #c8a065' 
            : holding 
            ? '1.5px solid rgba(200, 160, 101, 0.8)' 
            : '1.5px solid rgba(200, 160, 101, 0.3)',
          background: holding ? 'rgba(200, 160, 101, 0.12)' : 'transparent',
          boxShadow: completed || holding ? '0 0 40px rgba(200, 160, 101, 0.2)' : 'none',
        }}
      >
        {/* Animated fill circle */}
        <div
          className="absolute rounded-full transition-all duration-75"
          style={{
            width: `${progress * 100}%`,
            height: `${progress * 100}%`,
            background: completed ? 'rgba(200, 160, 101, 0.35)' : 'rgba(200, 160, 101, 0.22)',
          }}
        />

        {/* Ambient pulse ripples when holding */}
        {holding && (
          <div className="absolute inset-0 rounded-full border border-[#c8a065]/40 animate-ping opacity-30 pointer-events-none" />
        )}

        <div
          className={`font-display text-5xl transition-all duration-500 z-10 ${
            completed ? 'scale-125 text-[#c8a065]' : holding ? 'scale-110 text-[#c8a065]' : 'text-[#6b6560]'
          }`}
        >
          ∿
        </div>
      </div>

      <p className="text-xs tracking-[0.25em] uppercase text-center text-[#6b6560]">
        {completed
          ? 'Resonanz übertragen'
          : holding
          ? `${Math.max(1, Math.ceil((1 - progress) * durationSeconds))}s halten...`
          : `${durationSeconds} Sekunden berühren & halten`}
      </p>
    </div>
  )
}
