'use client'

import { useState, useEffect } from 'react'

interface Props {
  onComplete: () => void
}

export default function MysteryScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1200)
    const t2 = setTimeout(() => setPhase(2), 3500)
    const t3 = setTimeout(() => setPhase(3), 6500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden cursor-pointer select-none"
      style={{ background: '#0a0a0a' }}
      onClick={() => phase >= 2 && onComplete()}
    >
      {/* Ripple rings */}
      {phase >= 1 && (
        <>
          <div
            className="absolute rounded-full border animate-ripple"
            style={{ width: 48, height: 48, borderColor: 'rgba(200,160,101,0.3)' }}
          />
          <div
            className="absolute rounded-full border animate-ripple-2"
            style={{ width: 48, height: 48, borderColor: 'rgba(200,160,101,0.2)' }}
          />
          <div
            className="absolute rounded-full border animate-ripple-3"
            style={{ width: 48, height: 48, borderColor: 'rgba(200,160,101,0.1)' }}
          />
        </>
      )}

      {/* Core */}
      <div className="relative z-10 flex flex-col items-center gap-10">
        {phase >= 1 && (
          <div
            className="w-3 h-3 rounded-full animate-breathe animate-fade-in"
            style={{ background: '#c8a065' }}
          />
        )}

        {phase >= 2 && (
          <div
            className="animate-fade-up font-display text-7xl font-light"
            style={{ color: '#c8a065', animationDelay: '0ms' }}
          >
            ∿
          </div>
        )}

        {phase >= 3 && (
          <p
            className="animate-fade-up text-xs tracking-[0.35em] uppercase"
            style={{ color: '#6b6560', animationDelay: '0ms' }}
          >
            berühre um fortzufahren
          </p>
        )}
      </div>
    </div>
  )
}
