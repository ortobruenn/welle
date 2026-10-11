'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Props {
  onJoin: (name: string, enablePush?: boolean) => Promise<void>
}

type Stage = 'frequency' | 'seal' | 'name' | 'signal'

const TARGET_FREQ = 432
const FREQ_TOLERANCE = 14
const HOLD_DURATION_MS = 2200

export default function JoinScreen({ onJoin }: Props) {
  const [stage, setStage] = useState<Stage>('frequency')

  // --- STAGE 1: FREQUENCY TUNER STATE ---
  const [freq, setFreq] = useState(280)
  const [isHolding, setIsHolding] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0) // 0 to 1
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
  const holdStartRef = useRef<number | null>(null)

  const isNearTarget = Math.abs(freq - TARGET_FREQ) <= FREQ_TOLERANCE

  // Handle holding near target frequency
  useEffect(() => {
    if (stage !== 'frequency') return

    if (isNearTarget && isHolding) {
      if (!holdStartRef.current) holdStartRef.current = Date.now()

      const interval = setInterval(() => {
        const elapsed = Date.now() - (holdStartRef.current || Date.now())
        const prog = Math.min(1, elapsed / HOLD_DURATION_MS)
        setHoldProgress(prog)

        if (prog >= 1) {
          clearInterval(interval)
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate?.([40, 60, 100]) } catch {}
          }
          setTimeout(() => {
            setStage('seal')
          }, 400)
        }
      }, 50)

      return () => clearInterval(interval)
    } else {
      holdStartRef.current = null
      setHoldProgress(0)
    }
  }, [isNearTarget, isHolding, stage])

  // --- STAGE 2: SEAL GESTURE DRAWING STATE ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [points, setPoints] = useState<{ x: number; y: number }[]>([])
  const [sealFeedback, setSealFeedback] = useState<string | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [sealSuccess, setSealSuccess] = useState(false)

  // Initialize canvas
  useEffect(() => {
    if (stage !== 'seal' || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    // Clear
    ctx.clearRect(0, 0, rect.width, rect.height)
  }, [stage])

  const drawStroke = useCallback((pts: { x: number; y: number }[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)

    // Faint guide if user failed twice
    if (failedAttempts >= 2) {
      ctx.save()
      ctx.strokeStyle = 'rgba(200, 160, 101, 0.15)'
      ctx.lineWidth = 3
      ctx.setLineDash([6, 6])
      ctx.beginPath()
      const centerY = rect.height / 2
      const w = rect.width * 0.7
      const startX = (rect.width - w) / 2
      ctx.moveTo(startX, centerY)
      ctx.bezierCurveTo(
        startX + w * 0.25, centerY - 45,
        startX + w * 0.25, centerY - 45,
        startX + w * 0.5, centerY
      )
      ctx.bezierCurveTo(
        startX + w * 0.75, centerY + 45,
        startX + w * 0.75, centerY + 45,
        startX + w, centerY
      )
      ctx.stroke()
      ctx.restore()
    }

    if (pts.length < 2) return

    ctx.save()
    ctx.strokeStyle = '#c8a065'
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.shadowColor = 'rgba(200, 160, 101, 0.8)'
    ctx.shadowBlur = 12

    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y)
    }
    ctx.stroke()
    ctx.restore()
  }, [failedAttempts])

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (sealSuccess) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsDrawing(true)
    setSealFeedback(null)
    const newPts = [{ x, y }]
    setPoints(newPts)
    drawStroke(newPts)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || sealSuccess) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const newPts = [...points, { x, y }]
    setPoints(newPts)
    drawStroke(newPts)
  }

  const validateWaveGesture = (pts: { x: number; y: number }[]): boolean => {
    if (pts.length < 15) return false

    const xs = pts.map(p => p.x)
    const ys = pts.map(p => p.y)
    const width = Math.max(...xs) - Math.min(...xs)
    const height = Math.max(...ys) - Math.min(...ys)

    // Must have adequate width & height
    if (width < 65 || height < 15) return false

    // Check for oscillation: at least 1 reversal in Y
    let reversals = 0
    let lastDy = 0

    // Smooth samples
    for (let i = 2; i < pts.length; i += 2) {
      const dy = pts[i].y - pts[i - 2].y
      if (Math.abs(dy) > 4) {
        if (lastDy !== 0 && ((dy > 0 && lastDy < 0) || (dy < 0 && lastDy > 0))) {
          reversals++
        }
        lastDy = dy
      }
    }

    return reversals >= 1
  }

  const handlePointerUp = () => {
    if (!isDrawing || sealSuccess) return
    setIsDrawing(false)

    const isValid = validateWaveGesture(points)
    if (isValid) {
      setSealSuccess(true)
      setSealFeedback('Siegel erkannt. Die Schwingung ist rein.')
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate?.([60, 40, 80]) } catch {}
      }
      setTimeout(() => {
        setStage('name')
      }, 1100)
    } else {
      setSealFeedback('Keine Resonanz. Zeichne eine Schwingung mit Auf und Ab.')
      setFailedAttempts(prev => prev + 1)
      setTimeout(() => {
        setPoints([])
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        setSealFeedback(null)
      }, 1400)
    }
  }

  // --- STAGE 3: NAME WEIHE STATE ---
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleNameSubmit = () => {
    if (name.trim().length < 2) {
      setNameError('Wähle mindestens 2 Zeichen.')
      return
    }
    setNameError('')
    setStage('signal')
  }

  const handleFinishJoin = async (enablePush: boolean) => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (enablePush && typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const req = Notification.requestPermission()
          if (req && typeof req.then === 'function') {
            await Promise.race([
              req,
              new Promise((resolve) => setTimeout(resolve, 800)),
            ])
          }
        } catch {}
      }
      await onJoin(name.trim(), enablePush)
    } catch {
      setNameError('Einweihung fehlgeschlagen. Bitte erneut versuchen.')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden select-none"
      style={{ background: '#0a0a0a' }}
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div
          className="w-96 h-96 rounded-full transition-all duration-1000 blur-3xl opacity-20"
          style={{
            background: stage === 'frequency' && isNearTarget ? '#c8a065' : '#1a1815',
          }}
        />
      </div>

      {/* Progress Indicator */}
      <div className="absolute top-10 flex items-center gap-3 animate-fade-in z-20">
        <div
          className={`h-1 rounded-full transition-all duration-500 ${
            stage === 'frequency' ? 'w-8 bg-[#c8a065]' : 'w-4 bg-[#c8a065]/40'
          }`}
        />
        <div
          className={`h-1 rounded-full transition-all duration-500 ${
            stage === 'seal' ? 'w-8 bg-[#c8a065]' : stage === 'name' ? 'w-4 bg-[#c8a065]/40' : 'w-4 bg-[#222]'
          }`}
        />
        <div
          className={`h-1 rounded-full transition-all duration-500 ${
            stage === 'name' ? 'w-8 bg-[#c8a065]' : 'w-4 bg-[#222]'
          }`}
        />
      </div>

      {/* ========================================================================= */}
      {/* STAGE 1: FREQUENZ-SUCHE                                                   */}
      {/* ========================================================================= */}
      {stage === 'frequency' && (
        <div className="w-full max-w-sm flex flex-col items-center text-center animate-fade-up z-10">
          <div className="text-[11px] tracking-[0.35em] uppercase text-[#6b6560] mb-3">
            Erste Schwelle · Resonanz
          </div>
          <h2 className="font-display text-2xl md:text-3xl text-[#e8e4de] font-light mb-4">
            Suche die Grundfrequenz
          </h2>
          <p className="text-xs text-[#8a847d] leading-relaxed mb-10 max-w-xs">
            Bewege den Regler in die Stille. Finde den harmonischen Punkt und halte die Schwingung ruhig.
          </p>

          {/* Central Frequency Display with Pulse Ring */}
          <div className="relative w-44 h-44 flex items-center justify-center mb-10">
            {/* Background Halo */}
            <div
              className={`absolute inset-0 rounded-full border transition-all duration-300 ${
                isNearTarget
                  ? 'border-[#c8a065]/60 animate-ripple shadow-[0_0_30px_rgba(200,160,101,0.25)]'
                  : 'border-[#1e1e1e]'
              }`}
            />

            {/* Circular Hold Progress */}
            {isNearTarget && isHolding && (
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                <circle
                  cx="88"
                  cy="88"
                  r="82"
                  stroke="rgba(200,160,101,0.2)"
                  strokeWidth="4"
                  fill="none"
                />
                <circle
                  cx="88"
                  cy="88"
                  r="82"
                  stroke="#c8a065"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={2 * Math.PI * 82}
                  strokeDashoffset={2 * Math.PI * 82 * (1 - holdProgress)}
                  className="transition-all duration-75"
                />
              </svg>
            )}

            {/* Frequency Text */}
            <div className="flex flex-col items-center">
              <span
                className={`font-display text-4xl font-light transition-colors duration-300 ${
                  isNearTarget ? 'text-[#c8a065]' : 'text-[#8a847d]'
                }`}
              >
                {freq}
              </span>
              <span className="text-[10px] tracking-[0.25em] uppercase text-[#6b6560] mt-1">
                Hz
              </span>
            </div>
          </div>

          {/* Slider Control */}
          <div className="w-full px-4 mb-4">
            <input
              type="range"
              min={200}
              max={650}
              value={freq}
              onChange={e => setFreq(Number(e.target.value))}
              onPointerDown={() => setIsHolding(true)}
              onPointerUp={() => setIsHolding(false)}
              onTouchStart={() => setIsHolding(true)}
              onTouchEnd={() => setIsHolding(false)}
              className="w-full accent-[#c8a065] cursor-pointer h-2 bg-[#1a1a1a] rounded-lg appearance-none"
            />
          </div>

          <p
            className={`text-xs tracking-wider transition-all duration-300 min-h-[1.5rem] ${
              isNearTarget
                ? 'text-[#c8a065] font-medium'
                : 'text-[#555]'
            }`}
          >
            {isNearTarget
              ? isHolding
                ? 'Schwingung halten...'
                : 'Resonanz spürbar – Halte den Punkt!'
              : 'Tasten nach dem Signal...'}
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAGE 2: DAS SIEGEL DER WELLE                                             */}
      {/* ========================================================================= */}
      {stage === 'seal' && (
        <div className="w-full max-w-sm flex flex-col items-center text-center animate-fade-up z-10">
          <div className="text-[11px] tracking-[0.35em] uppercase text-[#6b6560] mb-3">
            Zweite Schwelle · Das Siegel
          </div>
          <h2 className="font-display text-2xl md:text-3xl text-[#e8e4de] font-light mb-3">
            Zeichne die Schwingung
          </h2>
          <p className="text-xs text-[#8a847d] leading-relaxed mb-6 max-w-xs">
            Nur wer die Form kennt, wird eingelassen. Zeichne das Siegel der Welle (∿) mit einem einzigen Strich.
          </p>

          {/* Drawing Canvas */}
          <div
            className={`relative w-full aspect-[4/3] rounded-sm border transition-all duration-500 overflow-hidden bg-[#0d0d0d] ${
              sealSuccess
                ? 'border-[#c8a065] shadow-[0_0_30px_rgba(200,160,101,0.3)]'
                : 'border-[#222] hover:border-[#333]'
            }`}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="w-full h-full cursor-crosshair touch-none"
            />

            {/* Glowing Success Overlay */}
            {sealSuccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                <span className="font-display text-7xl text-[#c8a065] animate-breathe">
                  ∿
                </span>
              </div>
            )}
          </div>

          {/* Feedback Text */}
          <p
            className={`text-xs tracking-wider mt-4 min-h-[1.5rem] transition-colors ${
              sealSuccess
                ? 'text-[#c8a065] font-medium'
                : sealFeedback
                ? 'text-red-400'
                : 'text-[#6b6560]'
            }`}
          >
            {sealFeedback || 'Mit dem Finger oder der Maus zeichnen'}
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAGE 3: DIE NAMENS-WEIHE                                                 */}
      {/* ========================================================================= */}
      {stage === 'name' && (
        <div className="w-full max-w-xs flex flex-col items-center text-center animate-fade-up z-10">
          <div className="font-display text-6xl text-[#c8a065] mb-6 animate-breathe">
            ∿
          </div>

          <div className="text-[11px] tracking-[0.35em] uppercase text-[#6b6560] mb-2">
            Letzte Schwelle · Die Weihe
          </div>
          <h2 className="font-display text-2xl text-[#e8e4de] font-light mb-3">
            Dein Knotenpunkt
          </h2>
          <p className="text-xs text-[#8a847d] leading-relaxed mb-8">
            Unter welchem Namen schwingst du in der Runde mit?
          </p>

          <div className="w-full flex flex-col gap-6">
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !submitting && handleNameSubmit()}
              maxLength={20}
              placeholder="Name..."
              className="w-full bg-transparent border-b border-[#2a2a2a] focus:border-[#c8a065] py-3 text-center text-xl text-[#e8e4de] focus:outline-none transition-colors caret-[#c8a065]"
            />

            {nameError && (
              <p className="text-xs text-[#c8a065] animate-fade-in">{nameError}</p>
            )}

            <button
              onClick={handleNameSubmit}
              disabled={submitting || name.trim().length < 2}
              className="w-full py-4 text-xs tracking-[0.3em] uppercase border border-[#c8a065] text-[#c8a065] hover:bg-[#c8a065]/10 disabled:opacity-25 transition-all shadow-[0_0_15px_rgba(200,160,101,0.1)] font-medium"
            >
              Weiter →
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAGE 4: DAS SIGNAL VERANKERN (PUSH-BENACHRICHTIGUNG)                      */}
      {/* ========================================================================= */}
      {stage === 'signal' && (
        <div className="w-full max-w-sm flex flex-col items-center text-center animate-fade-up z-10 px-4">
          <div className="font-display text-6xl text-[#c8a065] mb-6 animate-pulse">
            🔔
          </div>

          <div className="text-[11px] tracking-[0.35em] uppercase text-[#6b6560] mb-2">
            Letzter Schritt · Verbindung
          </div>
          <h2 className="font-display text-2xl text-[#e8e4de] font-light mb-3">
            Das Signal der Welle
          </h2>
          <p className="text-xs text-[#8a847d] leading-relaxed mb-8 max-w-xs">
            Die Welle ruft dich, sobald alle Freunde geantwortet haben oder der nächste Impuls beginnt.
          </p>

          <div className="w-full flex flex-col gap-4">
            <button
              onClick={() => handleFinishJoin(true)}
              disabled={submitting}
              className="w-full py-4 text-xs tracking-[0.25em] uppercase bg-[#c8a065] text-[#0a0a0a] rounded font-semibold transition-all shadow-[0_0_20px_rgba(200,160,101,0.3)] hover:opacity-90 active:scale-95 disabled:opacity-75 cursor-pointer"
            >
              {submitting ? 'Verbinde mit dem Zirkel...' : 'Signal empfangen (Push an) →'}
            </button>

            <button
              onClick={() => handleFinishJoin(false)}
              disabled={submitting}
              className="py-2 text-xs tracking-[0.2em] uppercase text-[#6b6560] hover:text-[#a09990] transition-colors disabled:opacity-30 cursor-pointer"
            >
              Später einrichten →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
