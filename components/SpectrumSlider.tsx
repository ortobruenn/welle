'use client'

import { useState, useRef, useCallback } from 'react'

interface Props {
  poleA: string
  poleB: string
  onComplete: (content: string) => void
}

export default function SpectrumSlider({ poleA, poleB, onComplete }: Props) {
  const [value, setValue] = useState(50) // 0 bis 100
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const lastHaptic = useRef<number>(50)

  const updateFromPosition = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return

    const rect = track.getBoundingClientRect()
    const rawRatio = (clientX - rect.left) / rect.width
    const clamped = Math.max(0, Math.min(1, rawRatio))
    const rounded = Math.round(clamped * 100)
    setValue(rounded)

    // Haptic feedback every 10%
    if (Math.abs(rounded - lastHaptic.current) >= 10 || (rounded === 50 && lastHaptic.current !== 50)) {
      lastHaptic.current = rounded
      if (navigator.vibrate) navigator.vibrate(15)
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    updateFromPosition(e.clientX)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    updateFromPosition(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  }

  const handleSubmit = () => {
    if (navigator.vibrate) navigator.vibrate([40, 30, 60])
    const payload = JSON.stringify({
      value,
      poleA,
      poleB,
    })
    onComplete(payload)
  }

  // Label calculation
  const getSubLabel = () => {
    if (value === 50) return 'Exakte Mitte · Ausgeglichen'
    if (value < 50) {
      const pct = (50 - value) * 2
      return `${pct}% Neigung zu „${poleA}“`
    } else {
      const pct = (value - 50) * 2
      return `${pct}% Neigung zu „${poleB}“`
    }
  }

  return (
    <div className="flex flex-col items-center gap-10 w-full select-none max-w-md mx-auto">
      {/* Dynamic lean indicator */}
      <div className="h-8 flex items-center justify-center animate-fade-in">
        <span
          className="text-xs tracking-[0.2em] uppercase transition-all duration-300"
          style={{ color: '#c8a065' }}
        >
          {getSubLabel()}
        </span>
      </div>

      {/* Spectrum Axis */}
      <div className="w-full flex flex-col gap-5 px-2">
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative h-14 flex items-center cursor-pointer touch-none"
        >
          {/* Background Axis Line */}
          <div className="w-full h-1 bg-[#1e1e1e] rounded-full relative overflow-hidden">
            {/* Center tick */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[#3a3a3a] -translate-x-1/2" />
          </div>

          {/* Active Accent Fill */}
          <div
            className="absolute h-1 bg-gradient-to-r from-[#c8a065]/40 to-[#c8a065] rounded-full pointer-events-none transition-all duration-75"
            style={{
              left: value <= 50 ? `${value}%` : '50%',
              width: `${Math.abs(value - 50)}%`,
            }}
          />

          {/* Draggable Knob */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 border-[#c8a065] bg-[#0a0a0a] flex items-center justify-center transition-transform duration-100 ${
              isDragging ? 'scale-125 shadow-[0_0_25px_rgba(200,160,101,0.5)]' : 'hover:scale-110 shadow-lg'
            }`}
            style={{ left: `${value}%` }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#c8a065]" />
          </div>
        </div>

        {/* Extremity Labels */}
        <div className="flex justify-between items-center text-xs tracking-wider uppercase text-[#6b6560] font-light">
          <span
            className={`transition-colors duration-200 max-w-[45%] text-left ${
              value < 40 ? 'text-[#e8e4de] font-medium' : ''
            }`}
          >
            ← {poleA}
          </span>
          <span
            className={`transition-colors duration-200 max-w-[45%] text-right ${
              value > 60 ? 'text-[#e8e4de] font-medium' : ''
            }`}
          >
            {poleB} →
          </span>
        </div>
      </div>

      {/* Confirm Button */}
      <button
        onClick={handleSubmit}
        className="w-full py-4 text-xs tracking-[0.25em] uppercase border border-[#c8a065] text-[#c8a065] hover:bg-[#c8a065]/10 transition-colors rounded-sm cursor-pointer mt-4"
      >
        Position festlegen →
      </button>
    </div>
  )
}
