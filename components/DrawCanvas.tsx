'use client'

import { useRef, useState, useEffect } from 'react'

interface Props {
  onSave: (dataUrl: string) => void
}

export default function DrawCanvas({ onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set background to black
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#c8a065'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true)
    setHasDrawn(true)
    draw(e)
  }

  const stopDraw = () => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas && hasDrawn) {
      onSave(canvas.toDataURL('image/webp', 0.8))
    }
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing && e.type !== 'mousedown' && e.type !== 'touchstart') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

    const x = ((clientX - rect.left) / rect.width) * canvas.width
    const y = ((clientY - rect.top) / rect.height) * canvas.height

    if (e.type === 'mousedown' || e.type === 'touchstart') {
      ctx.beginPath()
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    onSave('')
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="border border-[#1e1e1e] rounded overflow-hidden shadow-2xl relative w-full aspect-square max-w-[320px]">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="w-full h-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onMouseMove={draw}
          onTouchStart={startDraw}
          onTouchEnd={stopDraw}
          onTouchMove={draw}
        />
      </div>
      {hasDrawn && (
        <button
          onClick={clear}
          className="text-xs tracking-[0.2em] uppercase transition-opacity hover:opacity-70"
          style={{ color: '#6b6560' }}
        >
          Löschen ↺
        </button>
      )}
    </div>
  )
}
