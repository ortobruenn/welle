'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface Props {
  onSave: (dataUrl: string) => void
}

const INK_COLORS = [
  { id: 'amber', hex: '#d4a359', label: 'Bernstein' },
  { id: 'chalk', hex: '#f2efe9', label: 'Kreide' },
  { id: 'coral', hex: '#e05a47', label: 'Koralle' },
]

const INITIAL_SECONDS = 35
const MAX_TIME_MS = INITIAL_SECONDS * 1000

export default function DrawCanvas({ onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [inkColor, setInkColor] = useState('#d4a359')
  const [timeLeftMs, setTimeLeftMs] = useState(MAX_TIME_MS)
  const [timerStarted, setTimerStarted] = useState(false)
  const [locked, setLocked] = useState(false)

  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#09090c'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useEffect(() => {
    initCanvas()
  }, [initCanvas])

  useEffect(() => {
    if (!timerStarted || locked) return
    const start = Date.now()
    const initialRemaining = timeLeftMs

    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const next = Math.max(0, initialRemaining - elapsed)
      setTimeLeftMs(next)
      if (next <= 0) {
        setLocked(true)
        setIsDrawing(false)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([40, 30, 80])
        }
        const canvas = canvasRef.current
        if (canvas) {
          onSave(canvas.toDataURL('image/webp', 0.85))
        }
        clearInterval(interval)
      }
    }, 60)

    return () => clearInterval(interval)
  }, [timerStarted, locked])

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (locked) return
    const pt = getCoords(e)
    lastPoint.current = pt
    setIsDrawing(true)
    setHasDrawn(true)
    if (!timerStarted) {
      setTimerStarted(true)
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx) {
      ctx.fillStyle = inkColor
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || locked) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !lastPoint.current) return

    const pt = getCoords(e)
    ctx.strokeStyle = inkColor
    ctx.lineWidth = 4.2
    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    lastPoint.current = pt
  }

  const stopDraw = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    lastPoint.current = null
    const canvas = canvasRef.current
    if (canvas && hasDrawn) {
      onSave(canvas.toDataURL('image/webp', 0.85))
    }
  }

  const clearCanvas = () => {
    initCanvas()
    setHasDrawn(false)
    setTimerStarted(false)
    setLocked(false)
    setTimeLeftMs(MAX_TIME_MS)
    onSave('')
  }

  const pctLeft = (timeLeftMs / MAX_TIME_MS) * 100
  const secondsLeft = (timeLeftMs / 1000).toFixed(1)

  return (
    <div className="flex flex-col items-center gap-3.5 w-full max-w-sm mx-auto">
      {/* Top Bar: 35s Ink Sprint Timer & Color Picker */}
      <div className="w-full flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {INK_COLORS.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setInkColor(c.hex)}
              title={c.label}
              className="w-6 h-6 rounded-full transition-transform cursor-pointer"
              style={{
                background: c.hex,
                transform: inkColor === c.hex ? 'scale(1.22)' : 'scale(0.95)',
                boxShadow: inkColor === c.hex ? `0 0 12px ${c.hex}` : 'none',
                border: inkColor === c.hex ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono px-2.5 py-1 rounded-full"
            style={{
              background: locked
                ? 'rgba(224, 90, 71, 0.16)'
                : timerStarted
                ? 'rgba(212, 163, 89, 0.16)'
                : 'rgba(255,255,255,0.05)',
              color: locked ? '#e05a47' : timerStarted ? '#d4a359' : '#7c766e',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {locked ? '🔒 Tinte leer!' : timerStarted ? `⏱ ${secondsLeft}s` : '35.0s Sprint'}
          </span>

          {hasDrawn && (
            <button
              type="button"
              onClick={clearCanvas}
              className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full cursor-pointer transition-colors"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#9c958c',
              }}
            >
              Neu
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#1a1a20' }}>
        <div
          className="h-full transition-all duration-75"
          style={{
            width: `${pctLeft}%`,
            background: pctLeft < 25 ? '#e05a47' : '#d4a359',
          }}
        />
      </div>

      {/* Canvas Box */}
      <div
        className="relative w-full aspect-square rounded-2xl overflow-hidden touch-none"
        style={{
          border: locked
            ? '1px solid rgba(224, 90, 71, 0.45)'
            : '1px solid rgba(212, 163, 89, 0.3)',
          boxShadow: '0 16px 36px -12px rgba(0,0,0,0.75)',
        }}
      >
        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={stopDraw}
          className="w-full h-full block cursor-crosshair touch-none"
        />

        {!hasDrawn && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-1.5 p-6 text-center">
            <span className="text-2xl opacity-40">✍️</span>
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#7c766e' }}>
              Berühre das Feld – ab dem ersten Strich laufen 35 Sekunden!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
