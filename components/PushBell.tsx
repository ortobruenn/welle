'use client'

import { useState, useEffect } from 'react'
import { registerServiceWorker, subscribeToPush } from '@/lib/pushClient'

interface Props {
  memberId?: string
}

export default function PushBell({ memberId }: Props) {
  const [status, setStatus] = useState<'checking' | 'active' | 'inactive' | 'unsupported'>('checking')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    registerServiceWorker()

    if (typeof window === 'undefined') return

    if (!('Notification' in window) || !('PushManager' in window)) {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
      setStatus(isIos ? 'inactive' : 'unsupported')
      return
    }

    if (Notification.permission === 'granted') {
      setStatus('active')
      if (memberId) {
        subscribeToPush(memberId).catch(() => {})
      }
    } else {
      setStatus('inactive')
    }
  }, [memberId])

  const handleClick = async () => {
    if (!memberId) return

    const isIos = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    const isStandalone = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
    )

    if (isIos && !isStandalone) {
      alert('Auf dem iPhone: Bitte im Safari-Menü auf „Teilen“ (⎙) tippen und „Zum Home-Bildschirm“ wählen, um Push zu aktivieren.')
      return
    }

    setLoading(true)
    try {
      const ok = await subscribeToPush(memberId)
      if (ok || (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted')) {
        setStatus('active')
        setFeedback('Push aktiv!')
        setTimeout(() => setFeedback(null), 3000)
      } else {
        alert('Benachrichtigungen wurden im Browser nicht erlaubt.')
      }
    } catch (e: any) {
      alert('Fehler: ' + e?.message)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'unsupported' || !memberId) return null

  if (status === 'active') {
    return (
      <span
        title="Push-Benachrichtigungen sind aktiv"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#c8a065]/30 bg-[#c8a065]/5 text-[10px] tracking-wider text-[#c8a065]"
      >
        <span>🔔</span>
        <span>{feedback || 'Aktiv'}</span>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#c8a065] bg-[#c8a065]/15 hover:bg-[#c8a065]/25 text-[10px] tracking-wider uppercase text-[#c8a065] font-medium shadow-[0_0_12px_rgba(200,160,101,0.25)] transition-all cursor-pointer animate-pulse active:scale-95"
    >
      <span>🔔</span>
      <span>{loading ? '...' : 'Push an'}</span>
    </button>
  )
}
