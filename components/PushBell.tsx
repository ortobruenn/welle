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
      // 1. Berechtigung prüfen/anfordern
      if (!('Notification' in window)) {
        alert('Benachrichtigungen werden von diesem Browser nicht unterstützt.')
        return
      }

      let perm = Notification.permission
      if (perm !== 'granted') {
        perm = await Notification.requestPermission()
      }

      if (perm !== 'granted') {
        alert('Benachrichtigungen stehen auf: „' + perm + '“.\nBitte in den Browser-/Android-Einstellungen für diese Seite erlauben.')
        setStatus('inactive')
        return
      }

      // 2. Lokaler Test über Service Worker
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready
        if (reg) {
          try {
            await reg.showNotification('Welle Direkt-Signal ∿', {
              body: 'Gerätetest erfolgreich! Benachrichtigungen auf diesem Gerät funktionieren.',
              icon: '/icons/icon-192.png',
              tag: 'direct-' + Date.now(),
              renotify: true,
            } as any)
          } catch (localErr: any) {
            console.warn('Local notification error:', localErr)
          }
        }
      }

      // 3. Im Backend registrieren & Server-Push auslösen
      await subscribeToPush(memberId)
      await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          title: 'Welle Server-Signal ∿',
          body: 'Das Signal wurde erfolgreich vom Server zugestellt.',
        }),
      })

      setStatus('active')
      setFeedback('Test gesendet!')
      setTimeout(() => setFeedback(null), 3000)
    } catch (e: any) {
      alert('Push-Fehler: ' + e?.message)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'unsupported' || !memberId) return null

  if (status === 'active') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title="Tippen für Push-Test auf diesem Gerät"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#c8a065]/40 bg-[#c8a065]/10 hover:bg-[#c8a065]/20 text-[10px] tracking-wider text-[#c8a065] cursor-pointer transition-all active:scale-95"
      >
        <span>🔔</span>
        <span>{loading ? 'Testet...' : feedback || 'Aktiv (Test)'}</span>
      </button>
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
