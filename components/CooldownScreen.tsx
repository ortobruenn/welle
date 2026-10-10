'use client'

import { useState, useEffect } from 'react'
import type { Wave } from '@/lib/types'

interface Props {
  wave: Wave
  onWaveReady: () => void
}

function getTimeLeft(nextWaveAt: string | null): { hours: number; minutes: number; seconds: number; total: number } {
  if (!nextWaveAt) return { hours: 0, minutes: 0, seconds: 0, total: 0 }
  const diff = new Date(nextWaveAt).getTime() - Date.now()
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0 }
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return { hours, minutes, seconds, total: diff }
}

export default function CooldownScreen({ wave, onWaveReady }: Props) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(wave.next_wave_at))

  useEffect(() => {
    const interval = setInterval(() => {
      const tl = getTimeLeft(wave.next_wave_at)
      setTimeLeft(tl)
      if (tl.total <= 0) {
        clearInterval(interval)
        onWaveReady()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [wave.next_wave_at, onWaveReady])

  const pad = (n: number) => String(n).padStart(2, '0')

  const isWaiting = !wave.next_wave_at || timeLeft.total > 0

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8"
      style={{ background: '#0a0a0a' }}
    >
      {/* Symbol */}
      <div
        className="font-display text-5xl font-light mb-16 animate-float"
        style={{ color: '#c8a065', opacity: 0.5 }}
      >
        ∿
      </div>

      {isWaiting && wave.next_wave_at ? (
        <div className="text-center animate-fade-in">
          <div
            className="font-display text-6xl font-light tracking-widest mb-4"
            style={{ color: '#e8e4de' }}
          >
            {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
          </div>
          <p className="text-xs tracking-[0.3em] uppercase" style={{ color: '#6b6560' }}>
            bis zur nächsten welle
          </p>
        </div>
      ) : (
        <div className="text-center animate-fade-in">
          <p className="text-sm tracking-[0.25em] uppercase mb-2" style={{ color: '#6b6560' }}>
            Welle {wave.number} abgeschlossen
          </p>
          <p className="text-xs tracking-[0.2em] uppercase" style={{ color: '#3a3a3a' }}>
            die nächste welle wird vorbereitet
          </p>
        </div>
      )}

      <p
        className="absolute bottom-10 text-xs tracking-[0.3em] uppercase"
        style={{ color: '#1e1e1e' }}
      >
        Welle {wave.number}
      </p>
    </div>
  )
}
