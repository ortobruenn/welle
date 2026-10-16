'use client'

import { useState, useEffect } from 'react'
import type { Wave } from '@/lib/types'
import { extractEcho } from '@/lib/mystery'
import WaveVisualizer from './WaveVisualizer'

interface Props {
  wave: Wave | null
  memberId?: string
  onWaveReady: () => void
}

function getTimeLeft(nextWaveAt: string | null): {
  hours: number
  minutes: number
  seconds: number
  total: number
} {
  if (!nextWaveAt) return { hours: 0, minutes: 0, seconds: 0, total: 0 }
  const diff = new Date(nextWaveAt).getTime() - Date.now()
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0 }
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return { hours, minutes, seconds, total: diff }
}

export default function CooldownScreen({ wave, onWaveReady }: Props) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(wave?.next_wave_at || null))
  const [expiredWaveId, setExpiredWaveId] = useState<string | null>(null)

  const isLockedAtZero = Boolean(wave?.id && expiredWaveId === wave.id)

  useEffect(() => {
    if (!wave?.next_wave_at) return

    let lastTrigger = 0
    const tick = () => {
      const tl = getTimeLeft(wave.next_wave_at)
      if (tl.total <= 0 || (wave.id && expiredWaveId === wave.id)) {
        if (wave.id && expiredWaveId !== wave.id) {
          setExpiredWaveId(wave.id)
        }
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, total: 0 })
        const now = Date.now()
        if (now - lastTrigger >= 3500) {
          lastTrigger = now
          onWaveReady()
        }
      } else {
        setTimeLeft(tl)
      }
    }

    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [wave?.id, wave?.next_wave_at, expiredWaveId, onWaveReady])

  const pad = (n: number) => String(n).padStart(2, '0')
  const echo = wave ? extractEcho(wave.options) : null
  const showZeroState = isLockedAtZero || timeLeft.total <= 0

  return (
    <div className="flex-1 flex flex-col items-center justify-between px-6 pb-12 pt-6 max-w-xl mx-auto w-full text-center">
      <div className="w-full">
        <WaveVisualizer variant="calm" intensity={0.6} height={54} />
      </div>

      <div className="my-auto py-8 space-y-8 w-full animate-fade-in">
        <div className="space-y-3">
          <span
            className="text-[10px] uppercase tracking-[0.28em] px-3 py-1 rounded-full inline-block"
            style={{
              background: 'rgba(212, 163, 89, 0.1)',
              color: '#d4a359',
              border: '1px solid rgba(212, 163, 89, 0.25)',
            }}
          >
            Ruhephase zwischen den Wellen
          </span>

          <div
            className={`font-display text-6xl sm:text-7xl font-light tracking-widest transition-all duration-300 ${
              showZeroState ? 'animate-pulse scale-105' : ''
            }`}
            style={{ color: showZeroState ? '#d4a359' : '#f2efe9' }}
          >
            {showZeroState
              ? '00:00:00'
              : `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)}`}
          </div>

          <p
            className="text-xs tracking-[0.25em] uppercase"
            style={{ color: showZeroState ? '#d4a359' : '#7c766e' }}
          >
            {showZeroState ? 'Neue Welle rollt an...' : 'bis zum nächsten gemeinsamen Impuls'}
          </p>
        </div>

        {/* Last Echo Reflection Card */}
        {echo && (
          <div className="glass-card rounded-2xl p-5 max-w-md mx-auto space-y-2">
            <span className="text-[10px] uppercase tracking-[0.2em] block" style={{ color: '#d4a359' }}>
              Nachklang aus Welle #{wave?.number}
            </span>
            <p className="font-display italic text-lg leading-relaxed" style={{ color: '#d8d3cb' }}>
              „{echo}“
            </p>
          </div>
        )}
      </div>

      <div className="h-4" />
    </div>
  )
}
