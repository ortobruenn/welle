'use client'

import { useState, useEffect, useRef } from 'react'
import type { Wave, Member, WaveResponse } from '@/lib/types'
import {
  extractEcho,
  extractUndercover,
  cleanOptions,
  parseSpectrumResponse,
  parseChallengeResponse,
  extractLogicConfig,
  extractScrambleConfig,
  extractReactions,
  extractUndercoverVotes,
} from '@/lib/mystery'
import WaveVisualizer from './WaveVisualizer'

interface Props {
  wave: Wave
  responses: WaveResponse[]
  members: Member[]
  currentMember?: Member | null
  onComplete: () => void
}

const SPARK_EMOJIS = ['🔥', '💀', '❤️', '🎯']

export default function RevealScreen({
  wave,
  responses,
  members,
  currentMember,
  onComplete,
}: Props) {
  const waveFormat = wave.format || wave.prompt_type
  const isSpectrum = waveFormat === 'spectrum'
  const isUndercover = waveFormat === 'undercover'
  const isDraw = waveFormat === 'draw'
  const isPhoto = waveFormat === 'photo'
  const isMemory = waveFormat === 'memory'
  const isLogic = waveFormat === 'logic'
  const isScramble = waveFormat === 'scramble'
  const isChallenge = isMemory || isLogic || isScramble
  const isLegacyNonGuess =
    waveFormat === 'pulse' ||
    waveFormat === 'silence' ||
    waveFormat === 'enigma' ||
    waveFormat === 'vibe'

  const currentUserId =
    currentMember?.id ||
    (typeof window !== 'undefined' ? localStorage.getItem('welle_member_id') : null)

  const otherResponses = responses.filter(r => r.member_id !== currentUserId)
  const supportsBlindGuessing =
    !isSpectrum &&
    !isUndercover &&
    !isChallenge &&
    !isLegacyNonGuess &&
    otherResponses.length > 0
  const supportsUndercoverVoting = isUndercover && otherResponses.length > 0

  const [isUnveiled, setIsUnveiled] = useState(
    !supportsBlindGuessing && !supportsUndercoverVoting
  )
  // responseId -> guessed memberId
  const [guesses, setGuesses] = useState<Record<string, string>>({})
  // Undercover suspect memberId selected by current user
  const [suspectMemberId, setSuspectMemberId] = useState<string | null>(null)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)

  const [echo, setEcho] = useState<string | null>(extractEcho(wave.options))
  const [loadingEcho, setLoadingEcho] = useState(false)
  const echoRequestedForWaveRef = useRef<string | null>(null)

  const undercover = isUndercover ? extractUndercover(wave.options) : null
  const poles = cleanOptions(wave.options)
  const reactionsMap = extractReactions(wave.options)
  const votesMap = extractUndercoverVotes(wave.options)

  useEffect(() => {
    const currentEcho = extractEcho(wave.options)
    if (currentEcho) {
      setEcho(currentEcho)
      setLoadingEcho(false)
    }
  }, [wave.options])

  // Auto-trigger echo synthesis once per wave if missing
  useEffect(() => {
    const currentEcho = extractEcho(wave.options)
    if (currentEcho) return
    if (responses.length === 0) return
    if (echoRequestedForWaveRef.current === wave.id) return

    echoRequestedForWaveRef.current = wave.id
    setLoadingEcho(true)
    fetch('/api/synthesize-echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waveId: wave.id }),
    })
      .then(r => r.json())
      .then(d => {
        if (d?.echo) setEcho(d.echo)
      })
      .catch(() => {})
      .finally(() => setLoadingEcho(false))
  }, [wave.id, wave.options, responses.length])

  const getMemberName = (memberId: string, fallback?: string) => {
    const m = members.find(x => x.id === memberId)
    return m?.name || fallback || 'Freund'
  }

  const otherMembers = members.filter(m => m.id !== currentUserId)

  // Blind Guessing Helpers
  const allGuessed =
    otherResponses.length > 0 && otherResponses.every(r => !!guesses[r.id])

  const guessStats = (() => {
    let correct = 0
    for (const r of otherResponses) {
      if (guesses[r.id] === r.member_id) correct++
    }
    return { correct, total: otherResponses.length }
  })()

  // Spectrum Calculations
  const spectrumAnalysis = (() => {
    if (!isSpectrum || responses.length === 0) return null
    const items = responses.map(r => {
      const parsed = parseSpectrumResponse(r.content)
      return {
        responseId: r.id,
        memberId: r.member_id,
        name: getMemberName(r.member_id, r.members?.name),
        self: parsed.self,
        guessAvg: parsed.guessAvg,
      }
    })
    const actualAvg = Math.round(
      items.reduce((acc, it) => acc + it.self, 0) / items.length
    )
    const minVal = Math.min(...items.map(i => i.self))
    const maxVal = Math.max(...items.map(i => i.self))
    const spread = maxVal - minVal
    const harmonyPct = Math.max(0, Math.min(100, Math.round(100 - spread)))

    // Who guessed closest to actualAvg?
    const withDiff = items
      .map(it => ({
        ...it,
        diff: Math.abs(it.guessAvg - actualAvg),
      }))
      .sort((a, b) => a.diff - b.diff)

    return {
      items,
      actualAvg,
      harmonyPct,
      radarChampion: withDiff[0] || null,
    }
  })()

  // Challenge Leaderboard Calculations (memory, logic, scramble)
  const challengeAnalysis = (() => {
    if (!isChallenge || responses.length === 0) return null
    const items = responses.map(r => {
      const parsed = parseChallengeResponse(r.content)
      return {
        responseId: r.id,
        memberId: r.member_id,
        name: getMemberName(r.member_id, r.members?.name),
        passed: parsed.passed,
        timeMs: parsed.timeMs,
        detail: parsed.detail,
        progress: parsed.progress ?? (parsed.passed ? 100 : 0),
      }
    })
    const sorted = [...items].sort((a, b) => {
      if (a.passed !== b.passed) return a.passed ? -1 : 1
      if (a.passed && b.passed) return a.timeMs - b.timeMs
      return (b.progress || 0) - (a.progress || 0)
    })
    const winners = sorted.filter(i => i.passed)
    const losers = sorted.filter(i => !i.passed)
    return {
      sorted,
      winners,
      losers,
      fastest: winners[0] || null,
      logicConfig: isLogic ? extractLogicConfig(wave.options) : null,
      scrambleConfig: isScramble
        ? extractScrambleConfig(wave.options, `${wave.id}-${wave.number}`)
        : null,
    }
  })()

  // Toggle live spark reaction on a card
  const handleToggleReaction = async (responseId: string, emoji: string) => {
    if (!currentMember) return
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15)
    }
    try {
      await fetch('/api/wave/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_reaction',
          waveId: wave.id,
          responseId,
          memberId: currentMember.id,
          memberName: currentMember.name,
          emoji,
        }),
      })
    } catch (e) {
      console.warn('Failed to toggle reaction:', e)
    }
  }

  // Submit Undercover Vote & Unveil
  const handleConfirmUndercoverVote = async () => {
    if (!suspectMemberId) return
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 20, 60])
    }
    setIsUnveiled(true)
    if (currentMember) {
      fetch('/api/wave/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cast_vote',
          waveId: wave.id,
          memberId: currentMember.id,
          suspectMemberId,
        }),
      }).catch(() => {})
    }
  }

  const handleUnveilBlindGuesses = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 20, 60])
    }
    setIsUnveiled(true)
  }

  return (
    <div className="flex-1 flex flex-col px-5 pb-12 pt-2 max-w-xl mx-auto w-full space-y-7">
      {/* Top Visualizer & Prompt Header */}
      <div className="text-center space-y-3 animate-fade-in">
        <WaveVisualizer
          variant={isUndercover ? 'danger' : isSpectrum ? 'sync' : 'amber'}
          intensity={1.1}
          height={48}
        />

        <span
          className="text-[10px] uppercase tracking-[0.25em] px-3 py-1 rounded-full inline-block"
          style={{
            background: isUndercover ? 'rgba(224, 90, 71, 0.14)' : 'rgba(212, 163, 89, 0.12)',
            color: isUndercover ? '#e05a47' : '#d4a359',
            border: isUndercover
              ? '1px solid rgba(224, 90, 71, 0.35)'
              : '1px solid rgba(212, 163, 89, 0.3)',
          }}
        >
          {isUndercover
            ? '🕵️ Sabotage-Verhör'
            : isSpectrum
            ? '🎚️ Frequenz-Abgleich'
            : isMemory
            ? '🧠 35s-Gedächtnis-Tresor · Auswertung'
            : isLogic
            ? '🧩 35s-Logik-Falle · Auswertung'
            : isScramble
            ? '⚡ 35s-Kniffel-Sprint · Auswertung'
            : isDraw
            ? '🎨 35s-Blindfunk Galerie'
            : isPhoto
            ? '📷 Live-Schnappschuss Galerie'
            : '🔒 Enthüllung der Welle'}
        </span>

        <h1
          className="font-display text-3xl sm:text-4xl font-light leading-snug px-2"
          style={{ color: '#f2efe9' }}
        >
          {wave.prompt}
        </h1>
      </div>

      {/* =================================================================== */}
      {/* CHALLENGE LEADERBOARD (Ruhmeshalle 🏆 vs. Trostpflaster-Club 🩹)    */}
      {/* =================================================================== */}
      {isChallenge && challengeAnalysis && (
        <div className="space-y-4 animate-fade-up">
          {/* Summary Podium Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card-amber rounded-2xl p-4 text-center space-y-1">
              <span className="text-[10px] uppercase tracking-[0.2em] block" style={{ color: '#49b882' }}>
                🏆 Ruhmeshalle ({challengeAnalysis.winners.length})
              </span>
              {challengeAnalysis.fastest ? (
                <>
                  <p className="font-display text-2xl font-semibold truncate" style={{ color: '#f2efe9' }}>
                    👑 {challengeAnalysis.fastest.name}
                  </p>
                  <p className="text-[11px]" style={{ color: '#9c958c' }}>
                    Schnellste Zeit: {(challengeAnalysis.fastest.timeMs / 1000).toFixed(1).replace('.', ',')}s ⚡
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-xl font-light" style={{ color: '#9c958c' }}>
                    Niemand!
                  </p>
                  <p className="text-[11px]" style={{ color: '#7c766e' }}>
                    Alle sind gescheitert
                  </p>
                </>
              )}
            </div>

            <div className="glass-card rounded-2xl p-4 text-center space-y-1">
              <span className="text-[10px] uppercase tracking-[0.2em] block" style={{ color: '#e05a47' }}>
                🩹 Trostpflaster ({challengeAnalysis.losers.length})
              </span>
              {challengeAnalysis.losers.length > 0 ? (
                <>
                  <p className="font-display text-xl font-medium truncate" style={{ color: '#f2efe9' }}>
                    {challengeAnalysis.losers.map(l => l.name).join(', ')}
                  </p>
                  <p className="text-[11px]" style={{ color: '#9c958c' }}>
                    Symbolisches Pflaster verliehen 🩹
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-xl font-light" style={{ color: '#49b882' }}>
                    0 Pflaster!
                  </p>
                  <p className="text-[11px]" style={{ color: '#9c958c' }}>
                    Die ganze Gruppe hat abgeliefert
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Official Solution / Logic Explanation Box */}
          {isLogic && challengeAnalysis.logicConfig && (
            <div
              className="rounded-2xl p-4 space-y-1.5"
              style={{
                background: 'rgba(212, 163, 89, 0.1)',
                border: '1px solid rgba(212, 163, 89, 0.35)',
              }}
            >
              <span className="text-[10px] uppercase tracking-[0.22em] font-semibold block" style={{ color: '#d4a359' }}>
                🧩 Logische Auflösung: {challengeAnalysis.logicConfig.choices[challengeAnalysis.logicConfig.correctIndex]}
              </span>
              <p className="text-xs leading-relaxed" style={{ color: '#e5e0d8' }}>
                {challengeAnalysis.logicConfig.explanation}
              </p>
            </div>
          )}

          {isScramble && challengeAnalysis.scrambleConfig && (
            <div
              className="rounded-2xl p-3.5 text-center"
              style={{
                background: 'rgba(212, 163, 89, 0.1)',
                border: '1px solid rgba(212, 163, 89, 0.3)',
              }}
            >
              <span className="text-xs font-medium" style={{ color: '#d4a359' }}>
                {challengeAnalysis.scrambleConfig.mode === 'word'
                  ? `🔓 Lösungswort: ${challengeAnalysis.scrambleConfig.solutionWord}`
                  : `🔓 Richtige Kombination: ${(challengeAnalysis.scrambleConfig.solutionIndices || [])
                      .map(i => (challengeAnalysis.scrambleConfig?.tiles || [])[i])
                      .join(' + ')} = ${challengeAnalysis.scrambleConfig.targetSum}`}
              </span>
            </div>
          )}

          {/* Ranked Member Result Cards */}
          <div className="space-y-3">
            {challengeAnalysis.sorted.map((item, rankIdx) => {
              const isMine = item.memberId === currentUserId
              const cardReactions = reactionsMap[item.responseId] || []
              const secStr = (item.timeMs / 1000).toFixed(1).replace('.', ',')

              return (
                <div
                  key={item.responseId}
                  className="rounded-2xl p-4 space-y-3 transition-all"
                  style={{
                    background: item.passed
                      ? 'rgba(73, 184, 130, 0.08)'
                      : 'rgba(224, 90, 71, 0.08)',
                    border: item.passed
                      ? '1px solid rgba(73, 184, 130, 0.35)'
                      : '1px solid rgba(224, 90, 71, 0.35)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: item.passed ? '#49b882' : 'rgba(224, 90, 71, 0.25)',
                          color: item.passed ? '#070709' : '#e05a47',
                        }}
                      >
                        {item.passed ? `#${rankIdx + 1}` : '🩹'}
                      </span>
                      <div>
                        <span className="text-sm font-semibold block" style={{ color: '#f2efe9' }}>
                          {item.name} {isMine ? '(Du)' : ''}
                          {item.passed && rankIdx === 0 ? ' ⚡' : ''}
                        </span>
                        <span className="text-xs" style={{ color: '#9c958c' }}>
                          {item.detail}
                        </span>
                      </div>
                    </div>

                    <span
                      className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full shrink-0"
                      style={{
                        background: item.passed
                          ? 'rgba(73, 184, 130, 0.18)'
                          : 'rgba(224, 90, 71, 0.18)',
                        color: item.passed ? '#49b882' : '#e05a47',
                      }}
                    >
                      {item.passed ? `🏆 ${secStr}s` : '🩹 Trostpflaster'}
                    </span>
                  </div>

                  {/* Live Spark Reactions */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {SPARK_EMOJIS.map(emoji => {
                        const myActive = cardReactions.some(
                          rx => rx.memberId === currentUserId && rx.emoji === emoji
                        )
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(item.responseId, emoji)}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs transition-transform active:scale-125 cursor-pointer"
                            style={{
                              background: myActive
                                ? 'rgba(212, 163, 89, 0.25)'
                                : 'rgba(255,255,255,0.04)',
                              border: myActive
                                ? '1px solid rgba(212, 163, 89, 0.6)'
                                : '1px solid rgba(255,255,255,0.07)',
                            }}
                          >
                            {emoji}
                          </button>
                        )
                      })}
                    </div>

                    {cardReactions.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {cardReactions.map((rx, i) => (
                          <span
                            key={i}
                            className="text-[11px] px-2 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              color: '#d8d3cb',
                            }}
                          >
                            {rx.emoji} {rx.memberName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SPECTRUM RADAR & HARMONY VISUALIZATION                              */}
      {/* =================================================================== */}
      {isSpectrum && spectrumAnalysis && (
        <div className="space-y-5 animate-fade-up">
          {/* Harmony & Radar Champion Banner */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card-amber rounded-2xl p-4 text-center space-y-1">
              <span className="text-[10px] uppercase tracking-[0.2em] block" style={{ color: '#d4a359' }}>
                Gruppen-Synchronizität
              </span>
              <p className="font-display text-3xl font-semibold" style={{ color: '#f2efe9' }}>
                {spectrumAnalysis.harmonyPct}%
              </p>
              <p className="text-[11px]" style={{ color: '#9c958c' }}>
                Gruppen-Schnitt: {spectrumAnalysis.actualAvg}%
              </p>
            </div>

            {spectrumAnalysis.radarChampion && (
              <div className="glass-card rounded-2xl p-4 text-center space-y-1">
                <span className="text-[10px] uppercase tracking-[0.2em] block" style={{ color: '#49b882' }}>
                  🎯 Radar-Champion
                </span>
                <p className="font-display text-2xl font-semibold truncate" style={{ color: '#f2efe9' }}>
                  {spectrumAnalysis.radarChampion.name}
                </p>
                <p className="text-[11px]" style={{ color: '#9c958c' }}>
                  Tipp {spectrumAnalysis.radarChampion.guessAvg}% (nur {spectrumAnalysis.radarChampion.diff}% daneben)
                </p>
              </div>
            )}
          </div>

          {/* Interactive Axis with All Member Pins */}
          <div className="glass-card rounded-2xl p-5 space-y-5">
            <div className="flex justify-between text-xs font-medium" style={{ color: '#9c958c' }}>
              <span className="max-w-[45%]">{poles?.[0] || '0%'}</span>
              <span className="max-w-[45%] text-right">{poles?.[1] || '100%'}</span>
            </div>

            <div className="relative h-14 flex items-center my-2">
              <div className="w-full h-2 rounded-full relative" style={{ background: '#1e1e26' }}>
                {/* Average Marker Line */}
                <div
                  className="absolute -top-3 -bottom-3 w-0.5"
                  style={{
                    left: `${spectrumAnalysis.actualAvg}%`,
                    background: 'rgba(73, 184, 130, 0.7)',
                  }}
                />
              </div>

              {/* Member Nodes */}
              {spectrumAnalysis.items.map((item, idx) => (
                <div
                  key={item.responseId}
                  className="absolute -translate-x-1/2 flex flex-col items-center"
                  style={{
                    left: `${item.self}%`,
                    top: idx % 2 === 0 ? '-6px' : '16px',
                  }}
                >
                  <div
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap shadow-md"
                    style={{
                      background:
                        item.memberId === currentMember?.id ? '#d4a359' : '#25252e',
                      color:
                        item.memberId === currentMember?.id ? '#070709' : '#f2efe9',
                      border: '1px solid rgba(255,255,255,0.18)',
                    }}
                  >
                    {item.name} · {item.self}%
                  </div>
                </div>
              ))}
            </div>

            {/* Individual Breakdown List */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              {spectrumAnalysis.items.map(it => (
                <div
                  key={it.responseId}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <span className="font-medium" style={{ color: '#f2efe9' }}>
                    {it.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span style={{ color: '#d4a359' }}>
                      Selbst: <strong>{it.self}%</strong>
                    </span>
                    <span style={{ color: '#49b882' }}>
                      Gruppen-Tipp: <strong>{it.guessAvg}%</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* BLIND GUESSING SCORE BANNER (Once Unveiled)                         */}
      {/* =================================================================== */}
      {supportsBlindGuessing && isUnveiled && (
        <div className="glass-card-amber rounded-2xl p-4 flex items-center justify-between animate-scale-in">
          <div>
            <span className="text-[10px] uppercase tracking-[0.22em] block" style={{ color: '#d4a359' }}>
              Dein Menschenkenner-Score
            </span>
            <p className="font-display text-2xl font-light mt-0.5" style={{ color: '#f2efe9' }}>
              {guessStats.correct} von {guessStats.total} richtig zugeordnet
            </p>
          </div>
          <span className="text-3xl">
            {guessStats.correct === guessStats.total ? '🎯' : guessStats.correct > 0 ? '✨' : '🙈'}
          </span>
        </div>
      )}

      {/* =================================================================== */}
      {/* UNDERCOVER DOSSIER BANNER (Once Unveiled)                           */}
      {/* =================================================================== */}
      {supportsUndercoverVoting && isUnveiled && undercover && (
        <div className="glass-card-danger rounded-2xl p-5 space-y-2.5 animate-scale-in">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: '#e05a47' }}>
              🕵️ Tarnung aufgeflogen!
            </span>
            <span
              className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
              style={{
                background:
                  suspectMemberId === undercover.memberId
                    ? 'rgba(73, 184, 130, 0.2)'
                    : 'rgba(224, 90, 71, 0.2)',
                color: suspectMemberId === undercover.memberId ? '#49b882' : '#f0b8b0',
              }}
            >
              {undercover.memberId === currentMember?.id
                ? 'Du warst der Maulwurf!'
                : suspectMemberId === undercover.memberId
                ? '✓ Du hast den Maulwurf enttarnt!'
                : '✗ Du wurdest getäuscht!'}
            </span>
          </div>
          <p className="font-display text-2xl" style={{ color: '#f2efe9' }}>
            <strong>{getMemberName(undercover.memberId, undercover.memberName)}</strong> war Undercover.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: '#f0b8b0' }}>
            Geheimer Sabotage-Auftrag: „{undercover.prompt}“
          </p>
        </div>
      )}

      {/* =================================================================== */}
      {/* RESPONSE CARDS (Blind-Beichte, 35s-Blindfunk, Foto, Sabotage)       */}
      {/* =================================================================== */}
      {!isSpectrum && !isChallenge && (
        <div className="space-y-4">
          {!isUnveiled && supportsBlindGuessing && (
            <p className="text-center text-xs uppercase tracking-[0.2em]" style={{ color: '#d4a359' }}>
              Ordne zu: Wer aus der Runde steckt hinter welcher Karte?
            </p>
          )}
          {!isUnveiled && supportsUndercoverVoting && (
            <p className="text-center text-xs uppercase tracking-[0.2em]" style={{ color: '#e05a47' }}>
              Verhör: Tippe auf die Person, die heute heimlich sabotiert hat!
            </p>
          )}

          {responses.map((r, idx) => {
            const isMine = r.member_id === currentUserId
            const authorName = getMemberName(r.member_id, r.members?.name)
            const isImage = (r.content || '').startsWith('data:image/')
            const guessedMemberId = guesses[r.id]
            const isCorrectGuess = guessedMemberId === r.member_id
            const isActualMole = isUndercover && undercover?.memberId === r.member_id
            const isSuspectedByMe = !isMine && suspectMemberId === r.member_id
            const cardReactions = reactionsMap[r.id] || []

            // Who voted for this person in Undercover mode?
            const votersForThisCard = Object.entries(votesMap)
              .filter(([, targetId]) => targetId === r.member_id)
              .map(([voterId]) => getMemberName(voterId))

            return (
              <div
                key={r.id}
                onClick={() => {
                  if (!isUnveiled && supportsUndercoverVoting && !isMine) {
                    setSuspectMemberId(r.member_id)
                  }
                }}
                className={`rounded-2xl p-5 transition-all space-y-3.5 ${
                  !isUnveiled && supportsUndercoverVoting && !isMine ? 'cursor-pointer' : ''
                }`}
                style={{
                  background:
                    isUnveiled && isActualMole
                      ? 'rgba(224, 90, 71, 0.12)'
                      : isSuspectedByMe && !isUnveiled
                      ? 'rgba(224, 90, 71, 0.14)'
                      : 'rgba(19, 19, 24, 0.88)',
                  border:
                    isUnveiled && isActualMole
                      ? '1px solid rgba(224, 90, 71, 0.55)'
                      : isSuspectedByMe && !isUnveiled
                      ? '1px solid rgba(224, 90, 71, 0.65)'
                      : isMine
                      ? '1px solid rgba(212, 163, 89, 0.35)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between gap-2">
                  {isUnveiled || isUndercover || isMine ? (
                    <div className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                        style={{
                          background: isActualMole && isUnveiled ? '#e05a47' : '#d4a359',
                          color: '#070709',
                        }}
                      >
                        {authorName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#f2efe9' }}>
                        {authorName} {isMine ? '(Du)' : ''}
                      </span>
                      {isUnveiled && isActualMole && (
                        <span
                          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: 'rgba(224, 90, 71, 0.25)', color: '#e05a47' }}
                        >
                          🕵️ Maulwurf
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs uppercase tracking-[0.2em]" style={{ color: '#7c766e' }}>
                      🔒 Versiegelter Beitrag #{idx + 1}
                    </span>
                  )}

                  {/* Guess Accuracy Badge */}
                  {isUnveiled && supportsBlindGuessing && !isMine && (
                    <span
                      className="text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-medium"
                      style={{
                        background: isCorrectGuess
                          ? 'rgba(73, 184, 130, 0.16)'
                          : 'rgba(224, 90, 71, 0.15)',
                        color: isCorrectGuess ? '#49b882' : '#e05a47',
                      }}
                    >
                      {isCorrectGuess
                        ? '✓ Richtig getippt'
                        : `Dein Tipp: ${getMemberName(guessedMemberId)}`}
                    </span>
                  )}

                  {/* Undercover Accusation Selection Indicator (Only for other members!) */}
                  {!isUnveiled && supportsUndercoverVoting && !isMine && (
                    <span
                      className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-medium"
                      style={{
                        background: isSuspectedByMe
                          ? '#e05a47'
                          : 'rgba(255,255,255,0.06)',
                        color: isSuspectedByMe ? '#070709' : '#9c958c',
                      }}
                    >
                      {isSuspectedByMe ? '🎯 Dein Verdacht' : 'Verdächtigen'}
                    </span>
                  )}
                </div>

                {/* Card Content */}
                {isImage ? (
                  <div className="flex justify-center py-2">
                    <img
                      src={r.content}
                      alt={isPhoto ? 'Schnappschuss' : 'Skizze'}
                      onClick={e => {
                        e.stopPropagation()
                        setLightboxImg(r.content)
                      }}
                      className={`w-full max-w-[280px] aspect-square ${
                        isPhoto ? 'object-cover' : 'object-contain'
                      } rounded-2xl border cursor-zoom-in transition-transform hover:scale-[1.02]`}
                      style={{
                        background: '#09090c',
                        borderColor: 'rgba(255,255,255,0.12)',
                      }}
                    />
                  </div>
                ) : (
                  <p
                    className="font-display text-2xl font-light leading-relaxed"
                    style={{ color: '#f2efe9' }}
                  >
                    „{r.content}“
                  </p>
                )}

                {/* Blind Guessing Selector Chips (Before Unveil) */}
                {!isUnveiled && supportsBlindGuessing && !isMine && (
                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] block" style={{ color: '#7c766e' }}>
                      Wer war das?
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {otherMembers.map(m => {
                        const selected = guesses[r.id] === m.id
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() =>
                              setGuesses(prev => ({ ...prev, [r.id]: m.id }))
                            }
                            className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
                            style={{
                              background: selected ? '#d4a359' : 'rgba(255,255,255,0.05)',
                              color: selected ? '#070709' : '#d8d3cb',
                              border: selected
                                ? '1px solid #d4a359'
                                : '1px solid rgba(255,255,255,0.1)',
                            }}
                          >
                            {m.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Undercover Voters Display (Once Unveiled) */}
                {isUnveiled && isUndercover && votersForThisCard.length > 0 && (
                  <div className="text-[11px]" style={{ color: '#9c958c' }}>
                    🕵️ Verdächtigt von: <strong>{votersForThisCard.join(', ')}</strong>
                  </div>
                )}

                {/* Live Spark Reactions Bar (Once Unveiled) */}
                {isUnveiled && (
                  <div className="pt-2.5 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {SPARK_EMOJIS.map(emoji => {
                        const myActive = cardReactions.some(
                          rx => rx.memberId === currentUserId && rx.emoji === emoji
                        )
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              handleToggleReaction(r.id, emoji)
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-transform active:scale-125 cursor-pointer"
                            style={{
                              background: myActive
                                ? 'rgba(212, 163, 89, 0.25)'
                                : 'rgba(255,255,255,0.04)',
                              border: myActive
                                ? '1px solid rgba(212, 163, 89, 0.6)'
                                : '1px solid rgba(255,255,255,0.07)',
                            }}
                          >
                            {emoji}
                          </button>
                        )
                      })}
                    </div>

                    {cardReactions.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {cardReactions.map((rx, i) => (
                          <span
                            key={i}
                            className="text-[11px] px-2 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              color: '#d8d3cb',
                            }}
                          >
                            {rx.emoji} {rx.memberName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Action Button to Unveil Guesses or Undercover Vote */}
          {!isUnveiled && supportsBlindGuessing && (
            <button
              type="button"
              onClick={handleUnveilBlindGuesses}
              disabled={!allGuessed}
              className="w-full py-4 rounded-2xl text-xs uppercase tracking-[0.22em] font-semibold transition-all cursor-pointer disabled:opacity-30"
              style={{
                background: allGuessed ? '#d4a359' : '#1b1b22',
                color: allGuessed ? '#070709' : '#7c766e',
                boxShadow: allGuessed
                  ? '0 10px 30px -8px rgba(212, 163, 89, 0.5)'
                  : 'none',
              }}
            >
              {allGuessed
                ? 'Tipps einloggen & Autoren enthüllen ∿'
                : 'Ordne erst allen Karten einen Namen zu'}
            </button>
          )}

          {!isUnveiled && supportsUndercoverVoting && (
            <div className="space-y-3 pt-1">
              <div className="glass-card rounded-2xl p-4 space-y-2.5">
                <span className="text-[10px] uppercase tracking-[0.2em] block text-center" style={{ color: '#e05a47' }}>
                  Wen aus der Runde klagst du als Maulwurf an?
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  {otherMembers.map(m => {
                    const selected = suspectMemberId === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSuspectMemberId(m.id)}
                        className="px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer"
                        style={{
                          background: selected ? '#e05a47' : 'rgba(255,255,255,0.05)',
                          color: selected ? '#070709' : '#f2efe9',
                          border: selected
                            ? '1px solid #e05a47'
                            : '1px solid rgba(255,255,255,0.12)',
                        }}
                      >
                        🎯 {m.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmUndercoverVote}
                disabled={!suspectMemberId}
                className="w-full py-4 rounded-2xl text-xs uppercase tracking-[0.22em] font-semibold transition-all cursor-pointer disabled:opacity-30"
                style={{
                  background: suspectMemberId ? '#e05a47' : '#1b1b22',
                  color: suspectMemberId ? '#070709' : '#7c766e',
                  boxShadow: suspectMemberId
                    ? '0 10px 30px -8px rgba(224, 90, 71, 0.5)'
                    : 'none',
                }}
              >
                {suspectMemberId
                  ? 'Anklage erheben & Maulwurf enttarnen 🕵️'
                  : 'Wähle oben einen Verdächtigen aus'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* DAS KI-ECHO DER WELLE                                               */}
      {/* =================================================================== */}
      {isUnveiled && (
        <div className="glass-card-amber rounded-2xl p-6 text-center space-y-2.5 animate-fade-up">
          <div className="flex items-center justify-center gap-2">
            <span style={{ color: '#d4a359' }}>∿</span>
            <span className="text-[10px] uppercase tracking-[0.25em] font-semibold" style={{ color: '#d4a359' }}>
              Das Echo der Runde
            </span>
            <span style={{ color: '#d4a359' }}>∿</span>
          </div>

          {echo ? (
            <p className="font-display italic text-xl sm:text-2xl leading-relaxed" style={{ color: '#f2efe9' }}>
              „{echo}“
            </p>
          ) : (
            <p className="text-xs uppercase tracking-[0.2em] animate-pulse py-2" style={{ color: '#9c958c' }}>
              Resonanz wird aus euren Antworten destilliert...
            </p>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* CONTINUE TO NEXT CYCLE BUTTON                                       */}
      {/* =================================================================== */}
      {isUnveiled && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onComplete}
            className="w-full py-4 rounded-2xl text-xs uppercase tracking-[0.22em] font-semibold transition-all cursor-pointer active:scale-98"
            style={{
              background: 'rgba(212, 163, 89, 0.16)',
              border: '1px solid rgba(212, 163, 89, 0.5)',
              color: '#d4a359',
            }}
          >
            Welle abschließen & Nächsten Zyklus starten →
          </button>
        </div>
      )}

      {/* Lightbox Modal for Drawings */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(4,4,6,0.9)', backdropFilter: 'blur(12px)' }}
          onClick={() => setLightboxImg(null)}
        >
          <img
            src={lightboxImg}
            alt="Vollbild"
            className="max-w-full max-h-[80vh] rounded-2xl border"
            style={{ borderColor: 'rgba(212,163,89,0.4)', background: '#09090c' }}
          />
        </div>
      )}
    </div>
  )
}
