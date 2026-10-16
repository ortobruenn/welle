'use client'

import { useState, useEffect, useRef } from 'react'
import type { ScrambleWaveConfig } from '@/lib/types'
import { serializeChallengeResponse } from '@/lib/mystery'

interface Props {
  config: ScrambleWaveConfig
  onSubmit: (payloadJson: string) => Promise<void>
  disabled?: boolean
}

const SCRAMBLE_LIMIT_MS = 35000 // 35 Sekunden Zeitlimit
const MAX_MISTAKES = 3

export default function ScrambleChallenge({ config, onSubmit, disabled }: Props) {
  const solutionWord = (config.solutionWord || 'KAFFEE').toUpperCase()
  const letters = config.scrambledLetters || solutionWord.split('')

  // Der 1. Buchstabe ist direkt als Starthilfe eingeloggt, damit die Aufgabe sofort klar & fair ist!
  const initialFirstTileIdx = letters.findIndex(c => c === solutionWord[0])

  const [hasStarted, setHasStarted] = useState(false)
  const [leftMs, setLeftMs] = useState(SCRAMBLE_LIMIT_MS)

  // Für 'word' Modus (Buchstabensalat): Liste der bereits richtig angetippten Kachel-Indizes
  const [lockedTileIndices, setLockedTileIndices] = useState<number[]>(
    initialFirstTileIdx >= 0 ? [initialFirstTileIdx] : []
  )
  const [mistakes, setMistakes] = useState(0)
  const [wrongTileFlashIdx, setWrongTileFlashIdx] = useState<number | null>(null)

  // Für 'numbers' Modus (Zahlen-Kombination): bis zu 3 gewählte Kachel-Indizes
  const [selectedNumIndices, setSelectedNumIndices] = useState<number[]>([])
  const [wrongSumFlash, setWrongSumFlash] = useState<number | null>(null)

  const [resultState, setResultState] = useState<{
    passed: boolean
    timeMs: number
    detail: string
  } | null>(null)

  const startRef = useRef<number>(0)
  const submittedRef = useRef(false)
  const lockedWordRef = useRef<number[]>(lockedTileIndices)
  const numIndicesRef = useRef<number[]>([])

  lockedWordRef.current = lockedTileIndices
  numIndicesRef.current = selectedNumIndices

  // 35s Countdown läuft erst los, wenn der User aktiv auf "Aufgabe starten" geklickt hat!
  useEffect(() => {
    if (!hasStarted) return
    startRef.current = Date.now()
    const interval = setInterval(() => {
      if (submittedRef.current) return
      const elapsed = Date.now() - startRef.current
      const rem = Math.max(0, SCRAMBLE_LIMIT_MS - elapsed)
      setLeftMs(rem)
      if (rem <= 0) {
        clearInterval(interval)
        handleTimeout()
      }
    }, 60)
    return () => clearInterval(interval)
  }, [hasStarted])

  const finishScramble = (passed: boolean, elapsedMs: number, detail: string, progress = 0) => {
    if (submittedRef.current) return
    submittedRef.current = true

    const cleanTimeMs = Math.max(250, Math.min(SCRAMBLE_LIMIT_MS, Math.round(elapsedMs)))
    setResultState({ passed, timeMs: cleanTimeMs, detail })

    const payload = serializeChallengeResponse({
      passed,
      timeMs: cleanTimeMs,
      detail,
      progress: passed ? 100 : progress,
    })

    setTimeout(() => {
      onSubmit(payload).catch(() => {})
    }, 950)
  }

  const handleTimeout = () => {
    if (config.mode === 'word') {
      const solvedCount = lockedWordRef.current.length
      finishScramble(
        false,
        SCRAMBLE_LIMIT_MS,
        `35s abgelaufen (${solvedCount}/${solutionWord.length} Buchstaben · Lösung: ${solutionWord})`,
        Math.round((solvedCount / solutionWord.length) * 80)
      )
    } else {
      const tiles = config.tiles || []
      const currentSum = numIndicesRef.current.reduce((acc, idx) => acc + (tiles[idx] || 0), 0)
      finishScramble(
        false,
        SCRAMBLE_LIMIT_MS,
        `35s abgelaufen (Letzte Summe: ${currentSum} statt ${config.targetSum})`,
        30
      )
    }
  }

  // Word Mode Handler: Schritt-für-Schritt Validierung mit direktem Feedback!
  const handleLetterTap = (tileIdx: number) => {
    if (!hasStarted || disabled || submittedRef.current || config.mode !== 'word') return
    if (lockedTileIndices.includes(tileIdx)) return

    const nextSlotIdx = lockedTileIndices.length
    const expectedChar = solutionWord[nextSlotIdx]
    const tappedChar = letters[tileIdx]

    if (tappedChar === expectedChar) {
      setWrongTileFlashIdx(null)
      const nextLocked = [...lockedTileIndices, tileIdx]
      setLockedTileIndices(nextLocked)

      if (nextLocked.length === solutionWord.length) {
        const elapsed = Date.now() - startRef.current
        const secStr = (elapsed / 1000).toFixed(1).replace('.', ',')
        finishScramble(true, elapsed, `„${solutionWord}“ in ${secStr}s gelöst`, 100)
      }
    } else {
      // Falscher Buchstabe für die aktuelle Position -> kurzes rotes Aufblinken
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40)
      }
      setWrongTileFlashIdx(tileIdx)
      const nextMistakes = mistakes + 1
      setMistakes(nextMistakes)

      setTimeout(() => {
        setWrongTileFlashIdx(prev => (prev === tileIdx ? null : prev))
      }, 500)

      if (nextMistakes >= MAX_MISTAKES) {
        const elapsed = Date.now() - startRef.current
        const secStr = (elapsed / 1000).toFixed(1).replace('.', ',')
        finishScramble(
          false,
          elapsed,
          `3 Fehlversuche nach ${secStr}s (Lösung: ${solutionWord})`,
          Math.round((lockedTileIndices.length / solutionWord.length) * 75)
        )
      }
    }
  }

  // Number Mode Handler
  const handleNumberTap = (idx: number) => {
    if (!hasStarted || disabled || submittedRef.current || config.mode !== 'numbers') return
    setWrongSumFlash(null)

    if (selectedNumIndices.includes(idx)) {
      setSelectedNumIndices(prev => prev.filter(i => i !== idx))
      return
    }

    const base = selectedNumIndices.length >= 3 ? selectedNumIndices.slice(1) : selectedNumIndices
    const next = [...base, idx]
    setSelectedNumIndices(next)

    if (next.length === 3) {
      const tiles = config.tiles || []
      const sum = next.reduce((acc, i) => acc + (tiles[i] || 0), 0)
      if (sum === config.targetSum) {
        const elapsed = Date.now() - startRef.current
        const secStr = (elapsed / 1000).toFixed(1).replace('.', ',')
        const combo = next.map(i => tiles[i]).join(' + ')
        finishScramble(
          true,
          elapsed,
          `${combo} = ${config.targetSum} in ${secStr}s geknackt`,
          100
        )
      } else {
        setWrongSumFlash(sum)
      }
    }
  }

  // Start-Screen pro User: Nichts läuft los, bevor der User aktiv startet!
  if (!hasStarted) {
    return (
      <div
        className="w-full max-w-sm mx-auto rounded-3xl p-6 text-center space-y-5 animate-fade-in"
        style={{
          background: 'rgba(18, 18, 22, 0.9)',
          border: '1px solid rgba(212, 163, 89, 0.35)',
        }}
      >
        <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl bg-[#d4a359]/15 border border-[#d4a359]/30">
          {config.mode === 'word' ? '🔤' : '🔢'}
        </div>

        <div className="space-y-2">
          <h3 className="font-display text-2xl font-medium" style={{ color: '#f2efe9' }}>
            {config.mode === 'word' ? '35s-Buchstabensalat' : '35s-Zahlen-Kombination'}
          </h3>
          {config.mode === 'word' ? (
            <p className="text-xs leading-relaxed" style={{ color: '#9c958c' }}>
              Wir suchen ein bekanntes Alltagswort mit{' '}
              <strong>{solutionWord.length} Buchstaben</strong> zum Hinweis oben. Der{' '}
              <strong>1. Buchstabe ist bereits vorgegeben</strong>! Tippe die restlichen Buchstaben
              der Reihe nach von links nach rechts an. Richtige Buchstaben rasten sofort grün ein.
            </p>
          ) : (
            <p className="text-xs leading-relaxed" style={{ color: '#9c958c' }}>
              Auf dem 3×3-Feld liegen 9 Zahlen. Finde und tippe innerhalb von{' '}
              <strong>35 Sekunden</strong> genau die <strong>3 Zahlen-Kacheln</strong> an, die
              zusammenaddiert exakt <strong>{config.targetSum}</strong> ergeben!
            </p>
          )}
          <p className="text-[11px]" style={{ color: '#d4a359' }}>
            Deine 35 Sekunden starten erst, wenn du unten auf Start tippst.
          </p>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => setHasStarted(true)}
          className="w-full py-4 rounded-2xl text-xs uppercase tracking-[0.22em] font-semibold transition-all cursor-pointer active:scale-98"
          style={{
            background: '#d4a359',
            color: '#070709',
            boxShadow: '0 10px 28px -8px rgba(212, 163, 89, 0.55)',
          }}
        >
          Aufgabe jetzt starten (35s) ⚡
        </button>
      </div>
    )
  }

  const tiles = config.tiles || []
  const currentNumSum = selectedNumIndices.reduce((acc, i) => acc + (tiles[i] || 0), 0)
  const heartsLeft = Math.max(0, MAX_MISTAKES - mistakes)

  return (
    <div className="w-full max-w-sm mx-auto space-y-4 select-none">
      {/* Header & 35s Countdown */}
      <div
        className="rounded-2xl px-4 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(18, 18, 22, 0.85)',
          border: '1px solid rgba(212, 163, 89, 0.25)',
        }}
      >
        <div className="text-left">
          <span className="text-[10px] uppercase tracking-[0.2em] block" style={{ color: '#d4a359' }}>
            {config.mode === 'word'
              ? `🔤 Buchstabensalat · Position ${Math.min(lockedTileIndices.length + 1, solutionWord.length)}/${solutionWord.length}`
              : '🔢 35s-Zahlen-Kombination'}
          </span>
          <span className="text-xs font-medium" style={{ color: '#f2efe9' }}>
            {config.mode === 'word'
              ? `Versuche: ${'❤️'.repeat(heartsLeft)}${'🖤'.repeat(mistakes)}`
              : `Wähle 3 Kacheln mit Summe ${config.targetSum}`}
          </span>
        </div>

        <span
          className="font-mono text-xl font-semibold tabular-nums"
          style={{ color: leftMs <= 6000 ? '#e05a47' : '#f2efe9' }}
        >
          {(leftMs / 1000).toFixed(1)}s
        </span>
      </div>

      {/* Timer Bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/10">
        <div
          className="h-full transition-all duration-75"
          style={{
            width: `${(leftMs / SCRAMBLE_LIMIT_MS) * 100}%`,
            background: leftMs <= 6000 ? '#e05a47' : '#49b882',
          }}
        />
      </div>

      {config.mode === 'word' ? (
        <div className="space-y-4">
          {/* Klare Hinweis-Box */}
          <div
            className="rounded-2xl px-4 py-3 text-center space-y-1"
            style={{
              background: 'rgba(212, 163, 89, 0.08)',
              border: '1px solid rgba(212, 163, 89, 0.25)',
            }}
          >
            <span className="text-[10px] uppercase tracking-[0.2em] block" style={{ color: '#d4a359' }}>
              Gesuchter Begriff ({solutionWord.length} Buchstaben)
            </span>
            <p className="text-sm font-medium" style={{ color: '#f2efe9' }}>
              „{config.hint || 'Bekanntes Alltagswort'}“
            </p>
          </div>

          {/* Solution Word Slots (Grün = Richtig eingerastet, Gelb umrandet = Nächstes Feld) */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 min-h-[54px] px-2.5 py-2.5 rounded-2xl bg-white/5 border border-white/10">
            {Array.from({ length: solutionWord.length }, (_, slotIdx) => {
              const isSolved = slotIdx < lockedTileIndices.length
              const isCurrentTarget = slotIdx === lockedTileIndices.length && !resultState
              const char = isSolved ? solutionWord[slotIdx] : ''

              return (
                <div
                  key={slotIdx}
                  className="w-9 h-11 rounded-xl flex items-center justify-center font-mono text-lg font-bold transition-all"
                  style={{
                    background: isSolved
                      ? 'rgba(73, 184, 130, 0.22)'
                      : isCurrentTarget
                      ? 'rgba(212, 163, 89, 0.16)'
                      : 'rgba(255,255,255,0.04)',
                    border: isSolved
                      ? '1.5px solid #49b882'
                      : isCurrentTarget
                      ? '1.5px solid #d4a359'
                      : '1px dashed rgba(255,255,255,0.18)',
                    color: isSolved ? '#49b882' : '#f2efe9',
                  }}
                >
                  {char || (isCurrentTarget ? '?' : '')}
                </div>
              )
            })}
          </div>

          {/* Scrambled Letter Tiles */}
          <div className="space-y-2">
            <p className="text-[11px] text-center" style={{ color: '#9c958c' }}>
              Tippe auf den Buchstaben für Position{' '}
              <strong>#{Math.min(lockedTileIndices.length + 1, solutionWord.length)}</strong>:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {letters.map((char, idx) => {
                const used = lockedTileIndices.includes(idx)
                const isWrongFlash = wrongTileFlashIdx === idx
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={used || submittedRef.current}
                    onClick={() => handleLetterTap(idx)}
                    className="w-12 h-12 rounded-2xl font-mono text-xl font-semibold transition-all cursor-pointer active:scale-95"
                    style={{
                      background: isWrongFlash
                        ? 'rgba(224, 90, 71, 0.35)'
                        : used
                        ? 'rgba(73, 184, 130, 0.12)'
                        : 'rgba(255,255,255,0.09)',
                      border: isWrongFlash
                        ? '2px solid #e05a47'
                        : used
                        ? '1px solid rgba(73, 184, 130, 0.35)'
                        : '1.5px solid rgba(212, 163, 89, 0.45)',
                      color: isWrongFlash
                        ? '#e05a47'
                        : used
                        ? 'rgba(73, 184, 130, 0.45)'
                        : '#f2efe9',
                    }}
                  >
                    {used ? '✓' : char}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Target Sum Display */}
          <div
            className="rounded-2xl p-3.5 flex items-center justify-around"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div className="text-center">
              <span className="text-[10px] uppercase tracking-widest block" style={{ color: '#9c958c' }}>
                Zielsumme
              </span>
              <span className="font-display text-3xl font-semibold" style={{ color: '#d4a359' }}>
                {config.targetSum}
              </span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <span className="text-[10px] uppercase tracking-widest block" style={{ color: '#9c958c' }}>
                Deine 3 Kacheln ({selectedNumIndices.length}/3)
              </span>
              <span
                className="font-mono text-2xl font-semibold"
                style={{
                  color:
                    wrongSumFlash !== null
                      ? '#e05a47'
                      : currentNumSum === config.targetSum && selectedNumIndices.length === 3
                      ? '#49b882'
                      : '#f2efe9',
                }}
              >
                {currentNumSum}
              </span>
            </div>
          </div>

          {/* 3x3 Number Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            {tiles.map((num, idx) => {
              const isSelected = selectedNumIndices.includes(idx)
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={submittedRef.current}
                  onClick={() => handleNumberTap(idx)}
                  className="h-16 rounded-2xl font-mono text-2xl font-semibold transition-all cursor-pointer active:scale-95"
                  style={{
                    background: isSelected
                      ? 'rgba(212, 163, 89, 0.25)'
                      : 'rgba(255, 255, 255, 0.06)',
                    border: isSelected
                      ? '2px solid #d4a359'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                    color: isSelected ? '#f2efe9' : '#d8d3cb',
                  }}
                >
                  {num}
                </button>
              )
            })}
          </div>

          {wrongSumFlash !== null && !resultState && (
            <p className="text-xs text-center" style={{ color: '#e05a47' }}>
              Summe ist {wrongSumFlash} (Ziel: {config.targetSum}) – tippe eine Kachel zum Tauschen!
            </p>
          )}
        </div>
      )}

      {resultState && (
        <div
          className="rounded-2xl p-3.5 text-center animate-fade-in"
          style={{
            background: resultState.passed
              ? 'rgba(73, 184, 130, 0.14)'
              : 'rgba(224, 90, 71, 0.14)',
            border: resultState.passed
              ? '1px solid rgba(73, 184, 130, 0.4)'
              : '1px solid rgba(224, 90, 71, 0.4)',
          }}
        >
          <p
            className="text-sm font-medium"
            style={{ color: resultState.passed ? '#49b882' : '#e05a47' }}
          >
            {resultState.passed
              ? `⚡ Geknackt! ${resultState.detail}`
              : `🩹 Trostpflaster! ${resultState.detail}`}
          </p>
        </div>
      )}
    </div>
  )
}
