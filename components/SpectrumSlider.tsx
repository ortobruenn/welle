'use client'

import { useState, useRef, useCallback } from 'react'
import { serializeSpectrumResponse } from '@/lib/mystery'

interface Props {
  poleA: string
  poleB: string
  onComplete: (content: string) => void
}

export default function SpectrumSlider({ poleA, poleB, onComplete }: Props) {
  const [selfValue, setSelfValue] = useState(50)
  const [guessAvg, setGuessAvg] = useState(50)
  const [activeDrag, setActiveDrag] = useState<'self' | 'guess' | null>(null)

  const selfTrackRef = useRef<HTMLDivElement | null>(null)
  const guessTrackRef = useRef<HTMLDivElement | null>(null)
  const lastHaptic = useRef<number>(50)

  const computePct = useCallback((clientX: number, track: HTMLDivElement | null) => {
    if (!track) return 50
    const rect = track.getBoundingClientRect()
    const rawRatio = (clientX - rect.left) / rect.width
    const clamped = Math.max(0, Math.min(1, rawRatio))
    const rounded = Math.round(clamped * 100)

    if (Math.abs(rounded - lastHaptic.current) >= 10) {
      lastHaptic.current = rounded
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12)
    }
    return rounded
  }, [])

  const handleSubmit = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([30, 20, 50])
    onComplete(serializeSpectrumResponse(selfValue, guessAvg, poleA, poleB))
  }

  return (
    <div className="flex flex-col gap-6 w-full select-none max-w-md mx-auto">
      {/* Pole Cards Header */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="p-3.5 rounded-2xl transition-all"
          style={{
            background: selfValue < 50 ? 'rgba(212, 163, 89, 0.12)' : 'rgba(255,255,255,0.03)',
            border:
              selfValue < 50
                ? '1px solid rgba(212, 163, 89, 0.4)'
                : '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <span className="text-[10px] uppercase tracking-[0.2em] block mb-1" style={{ color: '#d4a359' }}>
            Pol 0%
          </span>
          <p className="text-xs sm:text-sm font-medium leading-snug" style={{ color: '#f2efe9' }}>
            {poleA}
          </p>
        </div>

        <div
          className="p-3.5 rounded-2xl text-right transition-all"
          style={{
            background: selfValue > 50 ? 'rgba(212, 163, 89, 0.12)' : 'rgba(255,255,255,0.03)',
            border:
              selfValue > 50
                ? '1px solid rgba(212, 163, 89, 0.4)'
                : '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <span className="text-[10px] uppercase tracking-[0.2em] block mb-1" style={{ color: '#d4a359' }}>
            Pol 100%
          </span>
          <p className="text-xs sm:text-sm font-medium leading-snug" style={{ color: '#f2efe9' }}>
            {poleB}
          </p>
        </div>
      </div>

      {/* SLIDER 1: DEIN EIGENER PULS */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.18em] font-medium" style={{ color: '#d4a359' }}>
            1. Wo stehst du selbst?
          </span>
          <span className="font-mono text-sm font-semibold" style={{ color: '#f2efe9' }}>
            {selfValue}%
          </span>
        </div>

        <div
          ref={selfTrackRef}
          onPointerDown={e => {
            setActiveDrag('self')
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            setSelfValue(computePct(e.clientX, selfTrackRef.current))
          }}
          onPointerMove={e => {
            if (activeDrag === 'self') {
              setSelfValue(computePct(e.clientX, selfTrackRef.current))
            }
          }}
          onPointerUp={e => {
            setActiveDrag(null)
            ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
          }}
          className="relative h-12 flex items-center cursor-pointer touch-none"
        >
          <div className="w-full h-2 rounded-full relative overflow-hidden" style={{ background: '#1e1e24' }}>
            <div
              className="absolute top-0 bottom-0 rounded-full"
              style={{
                left: `${Math.min(50, selfValue)}%`,
                width: `${Math.abs(selfValue - 50)}%`,
                background: 'linear-gradient(90deg, #d4a359, #f0c987)',
              }}
            />
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2" />
          </div>

          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
            style={{ left: `${selfValue}%` }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center transition-transform"
              style={{
                background: '#d4a359',
                boxShadow: '0 0 18px rgba(212, 163, 89, 0.7)',
                transform: activeDrag === 'self' ? 'scale(1.2)' : 'scale(1)',
              }}
            >
              <div className="w-2 h-2 rounded-full bg-[#070709]" />
            </div>
          </div>
        </div>
      </div>

      {/* SLIDER 2: GRUPPEN-RADAR TIPP */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-[0.18em] font-medium block" style={{ color: '#49b882' }}>
              2. Gruppen-Radar (Bonus-Tipp)
            </span>
            <span className="text-[11px]" style={{ color: '#7c766e' }}>
              Wo landet heute der Durchschnitt der ganzen Runde?
            </span>
          </div>
          <span className="font-mono text-sm font-semibold" style={{ color: '#49b882' }}>
            {guessAvg}%
          </span>
        </div>

        <div
          ref={guessTrackRef}
          onPointerDown={e => {
            setActiveDrag('guess')
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            setGuessAvg(computePct(e.clientX, guessTrackRef.current))
          }}
          onPointerMove={e => {
            if (activeDrag === 'guess') {
              setGuessAvg(computePct(e.clientX, guessTrackRef.current))
            }
          }}
          onPointerUp={e => {
            setActiveDrag(null)
            ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
          }}
          className="relative h-12 flex items-center cursor-pointer touch-none"
        >
          <div className="w-full h-2 rounded-full relative overflow-hidden" style={{ background: '#1e1e24' }}>
            <div
              className="absolute top-0 bottom-0 rounded-full"
              style={{
                left: 0,
                width: `${guessAvg}%`,
                background: 'linear-gradient(90deg, rgba(73,184,130,0.25), rgba(73,184,130,0.85))',
              }}
            />
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2" />
          </div>

          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
            style={{ left: `${guessAvg}%` }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center transition-transform"
              style={{
                background: '#49b882',
                boxShadow: '0 0 16px rgba(73, 184, 130, 0.65)',
                transform: activeDrag === 'guess' ? 'scale(1.2)' : 'scale(1)',
              }}
            >
              <div className="w-2 h-2 rounded-full bg-[#070709]" />
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="w-full py-4 rounded-2xl text-xs uppercase tracking-[0.22em] font-semibold transition-all duration-300 cursor-pointer active:scale-98"
        style={{
          background: '#d4a359',
          color: '#070709',
          boxShadow: '0 10px 30px -8px rgba(212, 163, 89, 0.5)',
        }}
      >
        Frequenz & Tipp einloggen ∿
      </button>
    </div>
  )
}
