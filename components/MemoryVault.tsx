'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  generateDeterministicMemoryLayout,
  serializeChallengeResponse,
} from '@/lib/mystery'

interface Props {
  waveId: string
  waveNumber: number
  onSubmit: (payloadJson: string) => Promise<void>
  disabled?: boolean
}

const MEMORIZE_MS = 3200
const PLAY_LIMIT_MS = 35000 // 35 Sekunden Zeitlimit
const TOTAL_TARGETS = 6

export default function MemoryVault({ waveId, waveNumber, onSubmit, disabled }: Props) {
  // Deterministic positions for numbers 1..6 across all players of this wave
  const targetCells = useMemo(
    () => generateDeterministicMemoryLayout(`${waveId}-${waveNumber}`, TOTAL_TARGETS),
    [waveId, waveNumber]
  )

  // Map cellIndex (0..15) -> number (1..6)
  const cellToNumber = useMemo(() => {
    const map = new Map<number, number>()
    targetCells.forEach((cellIdx, idx) => {
      map.set(cellIdx, idx + 1)
    })
    return map
  }, [targetCells])

  // Startet erst auf 'ready' – der Timer läuft erst los, wenn der User aktiv auf Start tippt!
  const [phase, setPhase] = useState<'ready' | 'memorize' | 'play' | 'done'>('ready')
  const [memorizeLeftMs, setMemorizeLeftMs] = useState(MEMORIZE_MS)
  const [playLeftMs, setPlayLeftMs] = useState(PLAY_LIMIT_MS)
  const [nextExpected, setNextExpected] = useState(1)
  const [unlockedNumbers, setUnlockedNumbers] = useState<number[]>([])
  const [wrongCell, setWrongCell] = useState<number | null>(null)
  const [resultState, setResultState] = useState<{
    passed: boolean
    timeMs: number
    detail: string
  } | null>(null)

  const playStartRef = useRef<number>(0)
  const submittedRef = useRef(false)

  // Phase 1: 3.2s Memorize countdown (erst nach aktivem Klick auf Start!)
  useEffect(() => {
    if (phase !== 'memorize') return
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const rem = Math.max(0, MEMORIZE_MS - elapsed)
      setMemorizeLeftMs(rem)
      if (rem <= 0) {
        clearInterval(interval)
        playStartRef.current = Date.now()
        setPhase('play')
      }
    }, 50)
    return () => clearInterval(interval)
  }, [phase])

  // Phase 2: 35s Play countdown
  useEffect(() => {
    if (phase !== 'play') return
    if (!playStartRef.current) playStartRef.current = Date.now()

    const interval = setInterval(() => {
      const elapsed = Date.now() - playStartRef.current
      const rem = Math.max(0, PLAY_LIMIT_MS - elapsed)
      setPlayLeftMs(rem)
      if (rem <= 0) {
        clearInterval(interval)
        finishChallenge(false, PLAY_LIMIT_MS, unlockedNumbers.length, true)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [phase, unlockedNumbers.length])

  const finishChallenge = (
    passed: boolean,
    elapsedMs: number,
    stepsDone: number,
    isTimeout = false
  ) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setPhase('done')

    const cleanTimeMs = Math.max(250, Math.min(PLAY_LIMIT_MS, Math.round(elapsedMs)))
    const secStr = (cleanTimeMs / 1000).toFixed(1).replace('.', ',')
    const detail = passed
      ? `6/6 Zahlen in ${secStr}s geknackt`
      : isTimeout
      ? `35s abgelaufen (${stepsDone}/6 Zahlen)`
      : `Vergriffen bei Zahl ${stepsDone + 1}/6 nach ${secStr}s`

    setResultState({ passed, timeMs: cleanTimeMs, detail })

    const payload = serializeChallengeResponse({
      passed,
      timeMs: cleanTimeMs,
      detail,
      progress: Math.round((stepsDone / TOTAL_TARGETS) * 100),
    })

    setTimeout(() => {
      onSubmit(payload).catch(() => {})
    }, 950)
  }

  const handleCellTap = (cellIdx: number) => {
    if (disabled || phase === 'ready' || phase === 'done' || submittedRef.current) return

    const num = cellToNumber.get(cellIdx)

    // Allow tapping "1" during memorize phase to start immediately like Chimp Test!
    if (phase === 'memorize') {
      if (num === 1) {
        playStartRef.current = Date.now()
        setUnlockedNumbers([1])
        setNextExpected(2)
        setPhase('play')
      }
      return
    }

    // Already tapped this correct number
    if (num && unlockedNumbers.includes(num)) return

    const elapsed = Date.now() - (playStartRef.current || Date.now())

    if (num === nextExpected) {
      const updated = [...unlockedNumbers, num]
      setUnlockedNumbers(updated)
      if (num === TOTAL_TARGETS) {
        finishChallenge(true, elapsed, TOTAL_TARGETS, false)
      } else {
        setNextExpected(num + 1)
      }
    } else {
      setWrongCell(cellIdx)
      finishChallenge(false, elapsed, unlockedNumbers.length, false)
    }
  }

  if (phase === 'ready') {
    return (
      <div
        className="w-full max-w-sm mx-auto rounded-3xl p-6 text-center space-y-5 animate-fade-in"
        style={{
          background: 'rgba(18, 18, 22, 0.9)',
          border: '1px solid rgba(212, 163, 89, 0.35)',
        }}
      >
        <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl bg-[#d4a359]/15 border border-[#d4a359]/30">
          🧠
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-2xl font-medium" style={{ color: '#f2efe9' }}>
            Bereit für den Gedächtnis-Tresor?
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: '#9c958c' }}>
            Sobald du startest, leuchten die Zahlen <strong>1 bis 6</strong> für 3 Sekunden auf dem
            4×4-Feld auf. Präge dir ihre Positionen ein und tippe sie danach blind der Reihe nach (1
            → 6) innerhalb von <strong>35 Sekunden</strong> an.
          </p>
          <p className="text-[11px]" style={{ color: '#d4a359' }}>
            Dein persönlicher Timer startet erst, wenn du unten tippst!
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPhase('memorize')}
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

  const secRemaining = (playLeftMs / 1000).toFixed(1)

  return (
    <div className="w-full max-w-sm mx-auto space-y-4 select-none">
      {/* Status & Timer Header */}
      <div
        className="rounded-2xl px-4 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(18, 18, 22, 0.85)',
          border: '1px solid rgba(212, 163, 89, 0.25)',
        }}
      >
        <div className="text-left">
          <span
            className="text-[10px] uppercase tracking-[0.2em] block"
            style={{ color: phase === 'memorize' ? '#d4a359' : '#9c958c' }}
          >
            {phase === 'memorize'
              ? '👁️ Positionen einprägen!'
              : phase === 'play'
              ? `Tippe blind: Zahl #${nextExpected} von ${TOTAL_TARGETS}`
              : resultState?.passed
              ? '🏆 Tresor geknackt!'
              : '🩹 Trostpflaster verdient'}
          </span>
          <span className="text-xs font-medium" style={{ color: '#f2efe9' }}>
            {phase === 'memorize'
              ? 'Oder tippe direkt auf „1“ zum Starten'
              : phase === 'play'
              ? `Fortschritt: ${unlockedNumbers.length}/${TOTAL_TARGETS}`
              : resultState?.detail}
          </span>
        </div>

        <div className="text-right">
          <span
            className="font-mono text-xl font-semibold tabular-nums"
            style={{
              color:
                phase === 'memorize'
                  ? '#d4a359'
                  : playLeftMs <= 5000
                  ? '#e05a47'
                  : '#f2efe9',
            }}
          >
            {phase === 'memorize'
              ? `${(memorizeLeftMs / 1000).toFixed(1)}s`
              : `${secRemaining}s`}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/10">
        <div
          className="h-full transition-all duration-75"
          style={{
            width:
              phase === 'memorize'
                ? `${(memorizeLeftMs / MEMORIZE_MS) * 100}%`
                : `${(playLeftMs / PLAY_LIMIT_MS) * 100}%`,
            background:
              phase === 'memorize'
                ? '#d4a359'
                : playLeftMs <= 5000
                ? '#e05a47'
                : '#49b882',
          }}
        />
      </div>

      {/* 4x4 Vault Matrix */}
      <div className="grid grid-cols-4 gap-2.5 aspect-square w-full">
        {Array.from({ length: 16 }, (_, cellIdx) => {
          const num = cellToNumber.get(cellIdx)
          const isUnlocked = num ? unlockedNumbers.includes(num) : false
          const isWrong = wrongCell === cellIdx
          const showNumber = phase === 'memorize' || phase === 'done' || isUnlocked

          return (
            <button
              key={cellIdx}
              type="button"
              disabled={phase === 'done' || disabled}
              onClick={() => handleCellTap(cellIdx)}
              className="rounded-2xl flex items-center justify-center font-display text-2xl font-semibold transition-all duration-150 cursor-pointer active:scale-95"
              style={{
                background: isWrong
                  ? 'rgba(224, 90, 71, 0.28)'
                  : isUnlocked
                  ? 'rgba(73, 184, 130, 0.24)'
                  : phase === 'memorize' && num
                  ? 'rgba(212, 163, 89, 0.22)'
                  : phase === 'play'
                  ? 'rgba(255, 255, 255, 0.06)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: isWrong
                  ? '2px solid #e05a47'
                  : isUnlocked
                  ? '2px solid #49b882'
                  : phase === 'memorize' && num
                  ? '2px solid rgba(212, 163, 89, 0.75)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                color: isWrong
                  ? '#e05a47'
                  : isUnlocked
                  ? '#49b882'
                  : '#f2efe9',
                boxShadow:
                  phase === 'memorize' && num
                    ? '0 0 18px rgba(212, 163, 89, 0.22)'
                    : 'none',
              }}
            >
              {isWrong ? (
                <span>💥</span>
              ) : num && showNumber ? (
                <span>{num}</span>
              ) : phase === 'play' ? (
                <span className="text-xs opacity-25">•</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Result Banner */}
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
              ? `⚡ Stark! ${resultState.detail}`
              : `🩹 Trostpflaster! ${resultState.detail}`}
          </p>
        </div>
      )}
    </div>
  )
}
