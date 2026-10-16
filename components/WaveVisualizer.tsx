'use client'

import { useEffect, useRef } from 'react'

interface Props {
  variant?: 'amber' | 'danger' | 'calm' | 'sync'
  intensity?: number
  height?: number
}

export default function WaveVisualizer({
  variant = 'amber',
  intensity = 1,
  height = 68,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = 0
    let phase = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    resize()
    window.addEventListener('resize', resize)

    const colors =
      variant === 'danger'
        ? ['rgba(224, 90, 71, 0.75)', 'rgba(224, 90, 71, 0.35)', 'rgba(212, 163, 89, 0.2)']
        : variant === 'calm'
        ? ['rgba(212, 163, 89, 0.32)', 'rgba(212, 163, 89, 0.14)', 'rgba(255, 255, 255, 0.06)']
        : variant === 'sync'
        ? ['rgba(73, 184, 130, 0.7)', 'rgba(212, 163, 89, 0.45)', 'rgba(212, 163, 89, 0.18)']
        : ['rgba(212, 163, 89, 0.8)', 'rgba(212, 163, 89, 0.35)', 'rgba(255, 255, 255, 0.12)']

    const render = () => {
      const w = canvas.getBoundingClientRect().width
      const h = canvas.getBoundingClientRect().height
      ctx.clearRect(0, 0, w, h)

      const midY = h / 2
      phase += 0.024 * intensity

      // Mittellinie (Nulllinie), zu den Rändern ausgeblendet
      const baseline = ctx.createLinearGradient(0, 0, w, 0)
      baseline.addColorStop(0, 'rgba(255,255,255,0)')
      baseline.addColorStop(0.5, 'rgba(255,255,255,0.10)')
      baseline.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.strokeStyle = baseline
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, midY)
      ctx.lineTo(w, midY)
      ctx.stroke()

      for (let i = 0; i < 3; i++) {
        ctx.shadowColor = i === 0 ? colors[0] : 'transparent'
        ctx.shadowBlur = i === 0 ? 10 : 0
        ctx.beginPath()
        ctx.strokeStyle = colors[i]
        ctx.lineWidth = i === 0 ? 1.8 : 1.1
        const amp = (11 - i * 3) * intensity
        const freq = 0.016 + i * 0.005
        const speedOffset = phase * (1 + i * 0.35)

        for (let x = 0; x <= w; x += 3) {
          // Envelope tapers smoothly at left & right edges
          const normX = x / w
          const envelope = Math.sin(normX * Math.PI)
          const y =
            midY +
            Math.sin(x * freq + speedOffset) * amp * envelope +
            Math.cos(x * freq * 0.6 - speedOffset * 0.7) * (amp * 0.35) * envelope

          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [variant, intensity])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: `${height}px` }}
      className="pointer-events-none block opacity-90"
    />
  )
}
