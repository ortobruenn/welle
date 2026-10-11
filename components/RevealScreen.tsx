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
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)

  const isPulse = wave.prompt_type === 'pulse'
  const isSilence = wave.prompt_type === 'silence'
  const isSpectrum = wave.prompt_type === 'spectrum'

  useEffect(() => {
    // For pulse, silence or spectrum, show after a brief atmospheric delay
    if (isPulse || isSilence || isSpectrum) {
      const timer = setTimeout(() => setDone(true), 1600)
      return () => clearTimeout(timer)
    }

    // Reveal one response at a time for text, photo, draw, choice
    if (visibleCount < responses.length) {
      const timer = setTimeout(() => {
        setVisibleCount(v => v + 1)
      }, visibleCount === 0 ? 800 : 1300)
      return () => clearTimeout(timer)
    } else if (visibleCount >= responses.length && responses.length > 0) {
      const timer = setTimeout(() => setDone(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [visibleCount, responses.length, isPulse, isSilence, isSpectrum])

  const getMemberName = (memberId: string) => {
    const m = members.find(m => m.id === memberId)
    return m?.name || '?'
  }

  return (
    <div
      className="min-h-screen flex flex-col px-6 md:px-8 py-14 max-w-lg mx-auto"
      style={{ background: '#0a0a0a' }}
    >
      {/* Header */}
      <div className="mb-8 animate-fade-in flex items-center justify-between">
        <span className="text-xs tracking-[0.3em] uppercase" style={{ color: '#6b6560' }}>
          Welle {wave.number} · Enthüllung
        </span>
        <span className="text-xs tracking-[0.2em] uppercase" style={{ color: '#c8a065' }}>
          {isSpectrum ? 'Spektrum' : isPulse ? 'Resonanz' : wave.prompt_type === 'photo' ? 'Foto' : wave.prompt_type === 'draw' ? 'Skizze' : 'Ergebnis'}
        </span>
      </div>

      {/* Prompt */}
      <p
        className="font-display text-xl md:text-2xl font-light italic mb-10 text-center animate-fade-up"
        style={{ color: '#c8a065', animationDelay: '150ms' }}
      >
        „{wave.prompt}“
      </p>

      {/* 1. SPECIAL CASE: SPECTRUM REVEAL */}
      {isSpectrum ? (
        <div className="flex-1 flex flex-col justify-center animate-fade-up my-6 w-full">
          {(() => {
            const parsed = responses.map(r => {
              try {
                const data = JSON.parse(r.content)
                return {
                  id: r.id,
                  memberId: r.member_id,
                  value: typeof data.value === 'number' ? data.value : 50,
                  poleA: data.poleA || wave.options?.[0] || 'Pol A',
                  poleB: data.poleB || wave.options?.[1] || 'Pol B',
                }
              } catch {
                return {
                  id: r.id,
                  memberId: r.member_id,
                  value: 50,
                  poleA: wave.options?.[0] || 'Pol A',
                  poleB: wave.options?.[1] || 'Pol B',
                }
              }
            })

            const poleA = parsed[0]?.poleA || wave.options?.[0] || 'Pol A'
            const poleB = parsed[0]?.poleB || wave.options?.[1] || 'Pol B'

            return (
              <div className="flex flex-col gap-10 w-full">
                {/* Visual Spectrum Axis */}
                <div className="p-6 border border-[#1e1e1e] bg-[#0d0d0d] rounded-sm flex flex-col gap-8 shadow-2xl">
                  <div className="text-center">
                    <span className="text-xs tracking-[0.25em] uppercase text-[#c8a065]">
                      Die Resonanz-Achse
                    </span>
                  </div>

                  {/* Axis Line with Pins */}
                  <div className="relative h-20 flex items-center px-4 my-2">
                    {/* Background track line */}
                    <div className="w-full h-1 bg-[#1e1e1e] rounded-full relative">
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[#3a3a3a] -translate-x-1/2" />
                    </div>

                    {/* Member Pins on Axis */}
                    {parsed.map((item, idx) => {
                      const name = getMemberName(item.memberId)
                      const isEven = idx % 2 === 0
                      return (
                        <div
                          key={item.id}
                          className="absolute flex flex-col items-center -translate-x-1/2 transition-all duration-700 animate-fade-up"
                          style={{
                            left: `calc(1rem + (100% - 2rem) * ${item.value / 100})`,
                            top: isEven ? '2px' : 'auto',
                            bottom: isEven ? 'auto' : '2px',
                          }}
                        >
                          {isEven && (
                            <span className="text-[11px] tracking-wider text-[#e8e4de] mb-1 whitespace-nowrap bg-black/80 px-1.5 py-0.5 rounded border border-[#c8a065]/40 font-medium">
                              {name} ({item.value}%)
                            </span>
                          )}
                          <div className="w-4 h-4 rounded-full border-2 border-[#c8a065] bg-[#0a0a0a] flex items-center justify-center shadow-[0_0_12px_rgba(200,160,101,0.6)]">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#c8a065]" />
                          </div>
                          {!isEven && (
                            <span className="text-[11px] tracking-wider text-[#e8e4de] mt-1 whitespace-nowrap bg-black/80 px-1.5 py-0.5 rounded border border-[#c8a065]/40 font-medium">
                              {name} ({item.value}%)
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Pole Labels */}
                  <div className="flex justify-between items-center text-xs tracking-wider uppercase text-[#6b6560] px-2 pt-2 border-t border-[#1a1a1a]">
                    <span className="max-w-[45%] text-left font-medium text-[#c8a065]">
                      ← {poleA}
                    </span>
                    <span className="max-w-[45%] text-right font-medium text-[#c8a065]">
                      {poleB} →
                    </span>
                  </div>
                </div>

                {/* Individual Lean Breakdown */}
                <div className="flex flex-col gap-3">
                  {parsed.map(item => {
                    const name = getMemberName(item.memberId)
                    const leanText = item.value === 50
                      ? 'Exakt ausgeglichen in der Mitte'
                      : item.value < 50
                      ? `${(50 - item.value) * 2}% Neigung zu „${poleA}“`
                      : `${(item.value - 50) * 2}% Neigung zu „${poleB}“`

                    return (
                      <div
                        key={item.id}
                        className="p-4 border border-[#1e1e1e] bg-[#0a0a0a] rounded flex items-center justify-between"
                      >
                        <span className="text-xs tracking-widest uppercase text-[#c8a065]">
                          {name}
                        </span>
                        <span className="text-xs text-[#e8e4de]">
                          {leanText}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      ) : isPulse ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-up my-8">
          <div className="relative w-40 h-40 flex items-center justify-center mb-8">
            <div className="absolute inset-0 rounded-full border border-[#c8a065]/20 animate-ripple" />
            <div className="absolute inset-0 rounded-full border border-[#c8a065]/40 animate-ripple-2" />
            <div className="absolute inset-0 rounded-full border border-[#c8a065]/60 animate-ripple-3" />
            <div className="w-24 h-24 rounded-full border border-[#c8a065] flex items-center justify-center bg-[#c8a065]/10 animate-breathe">
              <span className="font-display text-4xl text-[#c8a065]">∿</span>
            </div>
          </div>

          <h3 className="font-display text-2xl text-[#e8e4de] mb-3">
            Gemeinsame Resonanz
          </h3>
          <p className="text-xs tracking-[0.2em] uppercase text-[#6b6560] max-w-xs mb-8">
            Eure Berührungen haben einander über die Distanz erreicht. Der Puls ist im Einklang.
          </p>

          {/* Members in sync */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {responses.map((resp) => (
              <span
                key={resp.id}
                className="px-3 py-1 border border-[#c8a065]/40 text-xs tracking-[0.15em] text-[#c8a065] rounded-full bg-[#c8a065]/5"
              >
                ● {getMemberName(resp.member_id)}
              </span>
            ))}
          </div>
        </div>
      ) : isSilence ? (
        /* 2. SPECIAL CASE: SILENCE REVEAL */
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-up my-8">
          <div className="w-20 h-20 rounded-full border border-[#c8a065]/40 flex items-center justify-center mb-6 animate-breathe bg-[#c8a065]/5">
            <span className="font-display text-3xl text-[#c8a065]">∿</span>
          </div>
          <h3 className="font-display text-2xl text-[#e8e4de] mb-3">
            Gemeinsame Stille
          </h3>
          <p className="text-xs tracking-[0.2em] uppercase text-[#6b6560] max-w-xs mb-6">
            Einen gemeinsamen Moment innegehalten.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {responses.map((resp) => (
              <span
                key={resp.id}
                className="px-3 py-1 border border-[#2a2a2a] text-xs tracking-[0.15em] text-[#e8e4de] rounded-full"
              >
                {getMemberName(resp.member_id)} ✓
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* 3. STANDARD REVEAL: TEXT, PHOTO, DRAW, CHOICE */
        <div className="flex flex-col gap-6 flex-1">
          {responses.slice(0, visibleCount).map((response) => {
            const isImage = response.content.startsWith('data:image/')
            return (
              <div
                key={response.id}
                className="animate-reveal-card p-6 border transition-all duration-500"
                style={{
                  borderColor: '#1e1e1e',
                  background: '#0d0d0d',
                  borderRadius: 2,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-xs tracking-[0.2em] uppercase"
                    style={{ color: '#c8a065' }}
                  >
                    {getMemberName(response.member_id)}
                  </span>
                  {isImage && (
                    <span className="text-[10px] tracking-wider text-[#6b6560] uppercase">
                      Tippen zum Vergrößern
                    </span>
                  )}
                </div>

                {isImage ? (
                  <div
                    onClick={() => setLightboxImg(response.content)}
                    className="w-full aspect-square max-w-[320px] mx-auto rounded overflow-hidden border border-[#2a2a2a] hover:border-[#c8a065] transition-colors cursor-zoom-in my-2"
                  >
                    <img
                      src={response.content}
                      alt="Kreation"
                      className={`w-full h-full ${
                        wave.prompt_type === 'draw' ? 'object-contain bg-[#0a0a0a]' : 'object-cover'
                      }`}
                    />
                  </div>
                ) : (
                  <p
                    className="text-lg leading-relaxed font-display font-light"
                    style={{ color: '#e8e4de' }}
                  >
                    {wave.prompt_type === 'choice' ? `„${response.content}“` : response.content}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        >
          <img
            src={lightboxImg}
            alt="Vollbild"
            className="max-w-full max-h-[85vh] object-contain rounded border border-[#c8a065]/40 shadow-2xl"
          />
        </div>
      )}

      {/* Done button */}
      {done && (
        <button
          onClick={onComplete}
          className="mt-10 py-4 text-center text-sm tracking-[0.25em] uppercase transition-opacity hover:opacity-70 animate-fade-up border border-[#c8a065] text-[#c8a065] hover:bg-[#c8a065]/10"
        >
          Weiter →
        </button>
      )}
    </div>
  )
}
