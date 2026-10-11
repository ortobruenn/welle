'use client'

import { useState, useEffect } from 'react'
import type { Wave, Member, WaveResponse } from '@/lib/types'
import { extractEcho, extractGlitch, cleanOptions, extractEnigma, extractVibeOptions } from '@/lib/mystery'

interface Props {
  wave: Wave
  responses: WaveResponse[]
  members: Member[]
  currentMember?: Member | null
  onComplete: () => void
}

export default function RevealScreen({
  wave,
  responses,
  members,
  currentMember,
  onComplete,
}: Props) {
  const isPulse = wave.prompt_type === 'pulse'
  const isSilence = wave.prompt_type === 'silence'
  const isSpectrum = wave.prompt_type === 'spectrum'
  const isEnigma = wave.prompt_type === 'enigma'
  const isVibe = wave.prompt_type === 'vibe'
  const supportsBlindGuessing = !isPulse && !isSilence && !isSpectrum && !isEnigma && !isVibe && responses.length > 1

  // Mystery Guessing state
  const [isUnveiled, setIsUnveiled] = useState(!supportsBlindGuessing)
  const [guesses, setGuesses] = useState<Record<string, string>>({}) // responseId -> memberId
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)

  // Oracle Echo state
  const [echo, setEcho] = useState<string | null>(extractEcho(wave.options))
  const [loadingEcho, setLoadingEcho] = useState(false)

  // Glitch anomaly
  const glitch = extractGlitch(wave.options)

  useEffect(() => {
    if (!echo) {
      setLoadingEcho(true)
      fetch('/api/synthesize-echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waveId: wave.id }),
      })
        .then(res => res.json())
        .then(data => {
          if (data?.echo) setEcho(data.echo)
        })
        .catch(err => console.warn('Echo fetch error:', err))
        .finally(() => setLoadingEcho(false))
    }
  }, [wave.id, echo])

  const getMemberName = (memberId: string) => {
    const m = members.find(m => m.id === memberId)
    return m?.name || '?'
  }

  // Other members available to guess (excluding current user)
  const otherMembers = members.filter(m => m.id !== currentMember?.id)

  // Calculate guessing stats
  const calculateScore = () => {
    const guessableResponses = responses.filter(r => r.member_id !== currentMember?.id)
    if (guessableResponses.length === 0) return null

    let correct = 0
    let attempted = 0
    guessableResponses.forEach(r => {
      const g = guesses[r.id]
      if (g) {
        attempted++
        if (g === r.member_id) correct++
      }
    })

    return { correct, attempted, total: guessableResponses.length }
  }

  const score = isUnveiled && supportsBlindGuessing ? calculateScore() : null

  return (
    <div
      className="min-h-screen flex flex-col px-6 md:px-8 py-12 max-w-lg mx-auto"
      style={{ background: '#0a0a0a' }}
    >
      {/* Header */}
      <div className="mb-6 animate-fade-in flex items-center justify-between">
        <span className="text-xs tracking-[0.3em] uppercase" style={{ color: '#6b6560' }}>
          Welle {wave.number} · Enthüllung
        </span>
        <span className="text-xs tracking-[0.2em] uppercase" style={{ color: '#c8a065' }}>
          {isEnigma
            ? 'Rätsel-Anomalie'
            : isSpectrum
            ? 'Spektrum'
            : isVibe
            ? 'Vibe Check'
            : isPulse
            ? 'Resonanz'
            : isSilence
            ? 'Stille'
            : wave.prompt_type === 'photo'
            ? 'Foto'
            : wave.prompt_type === 'draw'
            ? 'Skizze'
            : 'Ergebnis'}
        </span>
      </div>

      {/* Prompt */}
      <p
        className="font-display text-xl md:text-2xl font-light italic mb-8 text-center animate-fade-up"
        style={{ color: '#c8a065', animationDelay: '100ms' }}
      >
        „{wave.prompt}“
      </p>

      {/* Blind Guessing Teaser Banner (when still veiled) */}
      {supportsBlindGuessing && !isUnveiled && (
        <div className="mb-6 p-4 rounded-sm border border-[#2a2a2a] bg-[#111111]/80 text-center animate-fade-in shadow-lg">
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="text-[#c8a065] text-xs">👁</span>
            <span className="text-[11px] tracking-[0.25em] uppercase text-[#c8a065] font-medium">
              Intuitions-Rätsel
            </span>
          </div>
          <p className="text-xs text-[#a09990] leading-relaxed">
            Die Schöpfer sind verborgen. Tippe auf die Namen, um zu raten, wer was abgegeben hat – oder lüfte den Schleier direkt.
          </p>
        </div>
      )}

      {/* 0. SPECIAL CASE: ENIGMA REVEAL */}
      {isEnigma ? (
        <div className="flex-1 flex flex-col justify-center animate-fade-up my-4 w-full">
          {(() => {
            const enigma = extractEnigma(wave.options)
            const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI']
            return (
              <div className="flex flex-col gap-6 w-full">
                <div className="p-6 md:p-8 border border-[#c8a065]/40 bg-[#0e0c08] rounded-sm shadow-2xl relative overflow-hidden">
                  <div className="text-center mb-6">
                    <span className="text-[11px] tracking-[0.3em] uppercase text-[#c8a065] font-semibold">
                      ✦ Die zusammengefügte Inschrift
                    </span>
                  </div>

                  {/* Assembled Fragments in Order */}
                  <div className="flex flex-col gap-3 mb-6">
                    {enigma?.fragments.map((frag, idx) => (
                      <div key={idx} className="p-3.5 bg-[#0a0a0a]/90 border border-[#231d14] rounded">
                        <span className="text-[10px] tracking-widest text-[#c8a065] uppercase block mb-1">
                          Fragment {romanNumerals[idx] || `${idx + 1}`}
                        </span>
                        <p className="font-display text-base text-[#e8e4de] italic leading-relaxed">
                          „{frag}“
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Solution Solved Banner */}
                  <div className="p-4 bg-[#c8a065]/10 border border-[#c8a065] rounded text-center">
                    <span className="text-[10px] tracking-[0.25em] uppercase text-[#c8a065] block mb-1">
                      Gelöstes Kollektiv-Siegel
                    </span>
                    <span className="font-display text-2xl tracking-[0.3em] text-[#e8e4de] font-semibold">
                      {enigma?.solution || 'GELÖST'}
                    </span>
                  </div>
                </div>

                {/* Solvers */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {responses.map(resp => (
                    <span
                      key={resp.id}
                      className="px-3 py-1 border border-[#c8a065]/40 text-xs tracking-[0.15em] text-[#c8a065] rounded-full bg-[#c8a065]/5"
                    >
                      ✓ {getMemberName(resp.member_id)}
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      ) : isSpectrum ? (
        <div className="flex-1 flex flex-col justify-center animate-fade-up my-4 w-full">
          {(() => {
            const choices = cleanOptions(wave.options)
            const parsed = responses.map(r => {
              try {
                const data = JSON.parse(r.content)
                return {
                  id: r.id,
                  memberId: r.member_id,
                  value: typeof data.value === 'number' ? data.value : 50,
                  poleA: data.poleA || choices?.[0] || 'Pol A',
                  poleB: data.poleB || choices?.[1] || 'Pol B',
                }
              } catch {
                return {
                  id: r.id,
                  memberId: r.member_id,
                  value: 50,
                  poleA: choices?.[0] || 'Pol A',
                  poleB: choices?.[1] || 'Pol B',
                }
              }
            })

            const poleA = parsed[0]?.poleA || choices?.[0] || 'Pol A'
            const poleB = parsed[0]?.poleB || choices?.[1] || 'Pol B'

            return (
              <div className="flex flex-col gap-8 w-full">
                {/* Visual Spectrum Axis */}
                <div className="p-6 border border-[#1e1e1e] bg-[#0d0d0d] rounded-sm flex flex-col gap-8 shadow-2xl">
                  <div className="text-center">
                    <span className="text-xs tracking-[0.25em] uppercase text-[#c8a065]">
                      Die Resonanz-Achse
                    </span>
                  </div>

                  {/* Axis Line with Pins */}
                  <div className="relative h-20 flex items-center px-4 my-2">
                    <div className="w-full h-1 bg-[#1e1e1e] rounded-full relative">
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[#3a3a3a] -translate-x-1/2" />
                    </div>

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
                    const leanText =
                      item.value === 50
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
                        <span className="text-xs text-[#e8e4de]">{leanText}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      ) : isVibe ? (
        /* SPECIAL CASE: VIBE REVEAL */
        <div className="flex-1 flex flex-col justify-center animate-fade-up my-4 w-full">
          {(() => {
            const vibeItems = extractVibeOptions(wave.options) || []
            const totalResponses = responses.length || 1

            return (
              <div className="flex flex-col gap-6 w-full">
                <div className="text-center mb-2">
                  <span className="text-xs tracking-[0.25em] uppercase text-[#c8a065]">
                    Das kollektive Stimmungsbild
                  </span>
                </div>

                <div className={`grid gap-4 w-full ${vibeItems.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  {vibeItems.map(item => {
                    const voters = responses.filter(r => r.content === item.title || r.content === item.id)
                    const count = voters.length
                    const percent = Math.round((count / totalResponses) * 100)
                    const maxVotes = Math.max(...vibeItems.map(vi => responses.filter(r => r.content === vi.title || r.content === vi.id).length))
                    const isWinner = count > 0 && count === maxVotes

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-lg border transition-all duration-300 flex flex-col justify-between ${
                          isWinner && count > 0
                            ? 'border-[#c8a065] bg-[#c8a065]/5 shadow-[0_0_20px_rgba(200,160,101,0.15)]'
                            : 'border-[#1e1e1e] bg-[#0d0d0d]'
                        }`}
                      >
                        <div>
                          {/* Image with zoom on click */}
                          <div
                            onClick={() => setLightboxImg(item.imageUrl)}
                            className="w-full aspect-square rounded-md overflow-hidden bg-[#161616] border border-[#2a2a2a] cursor-zoom-in relative mb-3 group"
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            {isWinner && count > 0 && (
                              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#c8a065] text-[#0a0a0a] text-[10px] font-bold tracking-wider uppercase shadow">
                                Favorit
                              </div>
                            )}
                          </div>

                          {/* Title */}
                          <h4 className="font-display text-base text-[#e8e4de] font-medium leading-snug mb-2">
                            {item.title}
                          </h4>
                        </div>

                        <div>
                          {/* Vote Bar */}
                          <div className="w-full bg-[#1c1c1c] rounded-full h-2 overflow-hidden mb-2">
                            <div
                              className="bg-[#c8a065] h-full transition-all duration-700 rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs text-[#6b6560] mb-3">
                            <span>{count} {count === 1 ? 'Stimme' : 'Stimmen'}</span>
                            <span className="font-mono text-[#c8a065]">{percent}%</span>
                          </div>

                          {/* Voters Tags */}
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#181818]">
                            {voters.length > 0 ? (
                              voters.map(v => {
                                const name = getMemberName(v.member_id)
                                const isMe = currentMember && v.member_id === currentMember.id
                                return (
                                  <span
                                    key={v.id}
                                    className="px-2 py-0.5 rounded border border-[#c8a065]/40 bg-[#c8a065]/10 text-[11px] tracking-wide text-[#e8e4de]"
                                  >
                                    {name} {isMe && <span className="text-[#c8a065]">(Du)</span>}
                                  </span>
                                )
                              })
                            ) : (
                              <span className="text-[11px] text-[#444] italic">Niemand</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      ) : isPulse ? (
        /* 2. SPECIAL CASE: PULSE REVEAL */
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-up my-6">
          <div className="relative w-36 h-36 flex items-center justify-center mb-6">
            <div className="absolute inset-0 rounded-full border border-[#c8a065]/20 animate-ripple" />
            <div className="absolute inset-0 rounded-full border border-[#c8a065]/40 animate-ripple-2" />
            <div className="absolute inset-0 rounded-full border border-[#c8a065]/60 animate-ripple-3" />
            <div className="w-20 h-20 rounded-full border border-[#c8a065] flex items-center justify-center bg-[#c8a065]/10 animate-breathe">
              <span className="font-display text-3xl text-[#c8a065]">∿</span>
            </div>
          </div>

          <h3 className="font-display text-2xl text-[#e8e4de] mb-2">Gemeinsame Resonanz</h3>
          <p className="text-xs tracking-[0.2em] uppercase text-[#6b6560] max-w-xs mb-6">
            Eure Berührungen haben einander über die Distanz erreicht.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {responses.map(resp => (
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
        /* 3. SPECIAL CASE: SILENCE REVEAL */
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-up my-6">
          <div className="w-20 h-20 rounded-full border border-[#c8a065]/40 flex items-center justify-center mb-6 animate-breathe bg-[#c8a065]/5">
            <span className="font-display text-3xl text-[#c8a065]">∿</span>
          </div>
          <h3 className="font-display text-2xl text-[#e8e4de] mb-2">Gemeinsame Stille</h3>
          <p className="text-xs tracking-[0.2em] uppercase text-[#6b6560] max-w-xs mb-6">
            Einen gemeinsamen Moment innegehalten.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {responses.map(resp => (
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
        /* 4. STANDARD REVEAL: TEXT, PHOTO, DRAW, CHOICE */
        <div className="flex flex-col gap-6 flex-1">
          {responses.map(response => {
            const isImage = response.content.startsWith('data:image/')
            const isMyResponse = currentMember && response.member_id === currentMember.id
            const trueAuthorName = getMemberName(response.member_id)
            const currentGuess = guesses[response.id]
            const guessedAuthorName = currentGuess ? getMemberName(currentGuess) : null
            const wasGuessedCorrectly = currentGuess === response.member_id

            return (
              <div
                key={response.id}
                className="p-6 border transition-all duration-500 rounded-sm relative overflow-hidden"
                style={{
                  borderColor: isUnveiled && wasGuessedCorrectly ? 'rgba(200,160,101,0.5)' : '#1e1e1e',
                  background: isUnveiled && wasGuessedCorrectly ? 'rgba(200,160,101,0.03)' : '#0d0d0d',
                }}
              >
                {/* Author Status Header */}
                <div className="flex items-center justify-between mb-3 border-b border-[#181818] pb-2.5">
                  {!isUnveiled ? (
                    isMyResponse ? (
                      <span className="text-xs tracking-[0.2em] uppercase text-[#c8a065] font-medium flex items-center gap-1.5">
                        <span>●</span> Deine Schöpfung
                      </span>
                    ) : (
                      <span className="text-xs tracking-[0.2em] uppercase text-[#736d65] font-light flex items-center gap-1.5">
                        <span className="text-[#c8a065]">?</span> Unbekannte Präsenz
                      </span>
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs tracking-[0.2em] uppercase text-[#c8a065] font-semibold">
                        {trueAuthorName}
                      </span>
                      {isMyResponse && (
                        <span className="text-[10px] tracking-wider uppercase text-[#6b6560]">
                          (Du)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Guess Tag in Header */}
                  {isUnveiled && !isMyResponse && currentGuess && (
                    <span
                      className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded border ${
                        wasGuessedCorrectly
                          ? 'border-[#c8a065] text-[#c8a065] bg-[#c8a065]/10'
                          : 'border-[#444] text-[#888]'
                      }`}
                    >
                      {wasGuessedCorrectly
                        ? '✓ Intuition bestätigt'
                        : `✕ Getippt: ${guessedAuthorName}`}
                    </span>
                  )}

                  {isImage && (
                    <span className="text-[10px] tracking-wider text-[#6b6560] uppercase">
                      Tippen zum Vergrößern
                    </span>
                  )}
                </div>

                {/* Content */}
                {isImage ? (
                  <div
                    onClick={() => setLightboxImg(response.content)}
                    className="w-full aspect-square max-w-[320px] mx-auto rounded overflow-hidden border border-[#2a2a2a] hover:border-[#c8a065] transition-colors cursor-zoom-in my-2"
                  >
                    <img
                      src={response.content}
                      alt="Kreation"
                      className={`w-full h-full ${
                        wave.prompt_type === 'draw'
                          ? 'object-contain bg-[#0a0a0a]'
                          : 'object-cover'
                      }`}
                    />
                  </div>
                ) : (
                  <p
                    className="text-lg leading-relaxed font-display font-light my-2"
                    style={{ color: '#e8e4de' }}
                  >
                    {wave.prompt_type === 'choice' ? `„${response.content}“` : response.content}
                  </p>
                )}

                {/* Blind Guessing Selector (Only while veiled, only for other people's answers) */}
                {!isUnveiled && !isMyResponse && otherMembers.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#1a1a1a]">
                    <span className="block text-[10px] tracking-[0.2em] uppercase text-[#6b6560] mb-2">
                      Wer hat das geschaffen?
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {otherMembers.map(m => {
                        const isChosen = currentGuess === m.id
                        return (
                          <button
                            key={m.id}
                            onClick={() =>
                              setGuesses(prev => ({
                                ...prev,
                                [response.id]: isChosen ? '' : m.id,
                              }))
                            }
                            className={`px-3 py-1.5 text-xs tracking-wider rounded-sm border transition-all ${
                              isChosen
                                ? 'border-[#c8a065] bg-[#c8a065]/15 text-[#e8e4de] shadow-[0_0_8px_rgba(200,160,101,0.25)]'
                                : 'border-[#222] bg-[#121212] text-[#888] hover:border-[#333]'
                            }`}
                          >
                            {m.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Button to Unveil the Veil */}
          {supportsBlindGuessing && !isUnveiled && (
            <button
              onClick={() => setIsUnveiled(true)}
              className="mt-4 py-4 w-full text-center text-sm tracking-[0.25em] uppercase border border-[#c8a065] text-[#c8a065] hover:bg-[#c8a065]/10 transition-all shadow-[0_0_20px_rgba(200,160,101,0.15)] font-medium"
            >
              Schleier lüften & Auflösen →
            </button>
          )}
        </div>
      )}

      {/* Intuition Result Score Banner */}
      {score && score.attempted > 0 && (
        <div className="my-6 p-4 border border-[#c8a065]/40 bg-[#c8a065]/5 rounded-sm animate-fade-in text-center">
          <div className="text-[11px] tracking-[0.25em] uppercase text-[#c8a065] mb-1 font-medium">
            ✦ Resonanz-Intuition
          </div>
          <p className="text-sm text-[#e8e4de]">
            {score.correct === score.total ? (
              <span>Vollkommener Gleichklang: {score.correct} von {score.total} Seelen erkannt!</span>
            ) : score.correct > 0 ? (
              <span>{score.correct} von {score.attempted} Zuordnungen durchschaut.</span>
            ) : (
              <span>Kein Treffer – eure Freunde haben euch heute überrascht.</span>
            )}
          </p>
        </div>
      )}

      {/* Oracle Echo Section (Appears after unveiling or on special waves) */}
      {isUnveiled && (echo || loadingEcho) && (
        <div className="my-8 p-6 rounded-sm border border-[#2a2a2a] bg-[#0e0e0e] shadow-2xl relative overflow-hidden animate-fade-up">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#c8a065]/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-[#c8a065] animate-pulse">🔮</span>
            <span className="text-[11px] tracking-[0.3em] uppercase text-[#c8a065] font-semibold">
              Echo der Welle
            </span>
          </div>

          {loadingEcho && !echo ? (
            <div className="flex items-center gap-3 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#c8a065] animate-breathe" />
              <p className="text-xs text-[#6b6560] italic">
                Die Welle lauscht euren Antworten und formt das Echo...
              </p>
            </div>
          ) : (
            <p className="font-display text-base md:text-lg italic text-[#e8e4de] leading-relaxed">
              „{echo}“
            </p>
          )}
        </div>
      )}

      {/* Whisper / Glitch Anomaly Reveal */}
      {isUnveiled && glitch && (
        <div className="my-4 p-5 border border-[#c8a065]/50 bg-[#16130d] rounded-sm animate-fade-up shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-[#c8a065]">⚡</span>
            <span className="text-xs tracking-[0.25em] uppercase text-[#c8a065] font-semibold">
              Anomalie der Welle · Ein Flüsterer unter euch
            </span>
          </div>
          <p className="text-xs text-[#a09990] mb-3 leading-relaxed">
            Die Welle hat auf einer gespaltenen Frequenz geschwungen.{' '}
            <span className="text-[#e8e4de] font-semibold">
              {glitch.memberName || getMemberName(glitch.memberId)}
            </span>{' '}
            empfing heimlich eine andere Aufforderung:
          </p>
          <div className="p-3 bg-[#0a0a0a] border border-[#2a2318] rounded text-sm italic text-[#c8a065]">
            „{glitch.prompt}“
          </div>
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

      {/* Done button (only visible when unveiled) */}
      {isUnveiled && (
        <button
          onClick={onComplete}
          className="mt-8 py-4 text-center text-sm tracking-[0.25em] uppercase transition-all border border-[#c8a065] text-[#c8a065] hover:bg-[#c8a065]/10 animate-fade-up font-medium"
        >
          Weiter zur Ruhephase →
        </button>
      )}
    </div>
  )
}
