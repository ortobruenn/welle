'use client'

import { useState, useEffect, useRef } from 'react'
import type { LogicWaveConfig } from '@/lib/types'
import { serializeChallengeResponse } from '@/lib/mystery'

interface Props {
  config: LogicWaveConfig
  onSubmit: (payloadJson: string) => Promise<void>
  disabled?: boolean
}

const LOGIC_LIMIT_MS = 35000 // 35s Denkzeit

export default function LogicRiddle({ config, onSubmit, disabled }: Props) {
  const [hasStarted, setHasStarted] = useState(false)
  const [leftMs, setLeftMs] = useState(LOGIC_LIMIT_MS)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [resultState, setResultState] = useState<{
    passed: boolean
    timeMs: number
    detail: string
  } | null>(null)

  const startRef = useRef<number>(0)
  const submittedRef = useRef(false)

  useEffect(() => {
    if (!hasStarted) return
    startRef.current = Date.now()
    const interval = setInterval(() => {
      if (submittedRef.current) return
      const elapsed = Date.now() - startRef.current
      const rem = Math.max(0, LOGIC_LIMIT_MS - elapsed)
      setLeftMs(rem)
      if (rem <= 0) {
        clearInterval(interval)
        finishLogic(null, LOGIC_LIMIT_MS)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [hasStarted])

  const finishLogic = (choiceIdx: number | null, elapsedMs: number) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSelectedIdx(choiceIdx)

    const cleanTimeMs = Math.max(300, Math.min(LOGIC_LIMIT_MS, Math.round(elapsedMs)))
    const secStr = (cleanTimeMs / 1000).toFixed(1).replace('.', ',')
    const passed = choiceIdx !== null && choiceIdx === config.correctIndex
    const pickedLabel =
      choiceIdx !== null && config.choices[choiceIdx]
        ? config.choices[choiceIdx]
        : 'Keine Antwort'

    const detail = passed
      ? `Logik geknackt in ${secStr}s (${pickedLabel})`
      : choiceIdx === null
      ? 'Denkzeit abgelaufen (35s)'
      : `Reingefallen auf „${pickedLabel}“ nach ${secStr}s`

    setResultState({ passed, timeMs: cleanTimeMs, detail })

    const payload = serializeChallengeResponse({
      passed,
      timeMs: cleanTimeMs,
      detail,
      answer: pickedLabel,
      progress: passed ? 100 : 0,
    })

    setTimeout(() => {
      onSubmit(payload).catch(() => {})
    }, 950)
  }

  if (!hasStarted) {
    return (
      <div
        className="w-full max-w-md mx-auto rounded-3xl p-6 text-center space-y-5 animate-fade-in"
        style={{
          background: 'rgba(18, 18, 22, 0.9)',
          border: '1px solid rgba(212, 163, 89, 0.35)',
        }}
      >
        <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl bg-[#d4a359]/15 border border-[#d4a359]/30">
          🧩
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-2xl font-medium" style={{ color: '#f2efe9' }}>
            Bereit für die Logik-Falle?
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: '#9c958c' }}>
            Lies die Frage oben genau durch. Sobald du startest, werden die 4 Antwortmöglichkeiten
            aufgedeckt und deine persönlichen <strong>35 Sekunden</strong> laufen. Du hast genau{' '}
            <strong>1 Versuch</strong>!
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
          Antworten aufdecken & 35s starten ⚡
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4 select-none">
      {/* Timer Bar */}
      <div
        className="rounded-2xl px-4 py-2.5 flex items-center justify-between"
        style={{
          background: 'rgba(18, 18, 22, 0.85)',
          border: '1px solid rgba(212, 163, 89, 0.25)',
        }}
      >
        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: '#d4a359' }}>
          🧩 Nur 1 Versuch · 35s Denkzeit
        </span>
        <span
          className="font-mono text-lg font-semibold tabular-nums"
          style={{ color: leftMs <= 6000 ? '#e05a47' : '#f2efe9' }}
        >
          {(leftMs / 1000).toFixed(1)}s
        </span>
      </div>

      <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/10">
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${(leftMs / LOGIC_LIMIT_MS) * 100}%`,
            background: leftMs <= 6000 ? '#e05a47' : '#d4a359',
          }}
        />
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 gap-2.5">
        {config.choices.map((choice, idx) => {
          const isSelected = selectedIdx === idx
          const isCorrect = idx === config.correctIndex
          const showOutcome = resultState !== null

          let borderColor = 'rgba(255, 255, 255, 0.1)'
          let bgColor = 'rgba(255, 255, 255, 0.04)'
          let textColor = '#f2efe9'

          if (showOutcome) {
            if (isCorrect) {
              borderColor = '#49b882'
              bgColor = 'rgba(73, 184, 130, 0.2)'
              textColor = '#49b882'
            } else if (isSelected && !isCorrect) {
              borderColor = '#e05a47'
              bgColor = 'rgba(224, 90, 71, 0.2)'
              textColor = '#e05a47'
            }
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={disabled || resultState !== null}
              onClick={() => finishLogic(idx, Date.now() - startRef.current)}
              className="w-full text-left px-4 py-3.5 rounded-2xl transition-all flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99]"
              style={{
                background: bgColor,
                border: `1.5px solid ${borderColor}`,
                color: textColor,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    color: '#d4a359',
                  }}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-sm font-medium">{choice}</span>
              </div>
              {showOutcome && isCorrect && <span>✓</span>}
              {showOutcome && isSelected && !isCorrect && <span>🩹</span>}
            </button>
          )
        })}
      </div>

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
              ? `🏆 Scharfsinn! ${resultState.detail}`
              : `🩹 Trostpflaster! ${resultState.detail}`}
          </p>
        </div>
      )}
    </div>
  )
}
