'use client'

import { useState, useEffect } from 'react'
import type { Wave, Member, WaveResponse } from '@/lib/types'

interface Props {
  wave: Wave
  responses: WaveResponse[]
  members: Member[]
  onComplete: () => void
}

export default function RevealScreen({ wave, responses, members, onComplete }: Props) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Reveal one response at a time
    if (visibleCount < responses.length) {
      const timer = setTimeout(() => {
        setVisibleCount(v => v + 1)
      }, visibleCount === 0 ? 800 : 1400)
      return () => clearTimeout(timer)
    } else if (visibleCount >= responses.length && responses.length > 0) {
      const timer = setTimeout(() => setDone(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [visibleCount, responses.length])

  const getMemberName = (memberId: string) => {
    const m = members.find(m => m.id === memberId)
    return m?.name || '?'
  }

  return (
    <div
      className="min-h-screen flex flex-col px-8 py-16"
      style={{ background: '#0a0a0a' }}
    >
      {/* Header */}
      <div className="mb-12 animate-fade-in">
        <span className="text-xs tracking-[0.3em] uppercase" style={{ color: '#6b6560' }}>
          Welle {wave.number} · Enthüllung
        </span>
      </div>

      {/* Prompt */}
      <p
        className="font-display text-xl font-light italic mb-12 animate-fade-up"
        style={{ color: '#6b6560', animationDelay: '200ms' }}
      >
        „{wave.prompt}"
      </p>

      {/* Responses */}
      <div className="flex flex-col gap-6 flex-1">
        {responses.slice(0, visibleCount).map((response, i) => (
          <div
            key={response.id}
            className="animate-reveal-card p-6 border"
            style={{
              borderColor: '#1e1e1e',
              background: '#0d0d0d',
              borderRadius: 2,
              animationDelay: `0ms`,
            }}
          >
            <p
              className="text-xs tracking-[0.2em] uppercase mb-3"
              style={{ color: '#c8a065' }}
            >
              {getMemberName(response.member_id)}
            </p>
            <p
              className="text-lg leading-relaxed font-display font-light"
              style={{ color: '#e8e4de' }}
            >
              {response.content}
            </p>
          </div>
        ))}
      </div>

      {/* Done button */}
      {done && (
        <button
          onClick={onComplete}
          className="mt-12 text-sm tracking-[0.25em] uppercase transition-opacity hover:opacity-70 animate-fade-up"
          style={{ color: '#c8a065' }}
        >
          Weiter →
        </button>
      )}
    </div>
  )
}
