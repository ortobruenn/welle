'use client'

import { useState, useEffect } from 'react'
import { registerServiceWorker, subscribeToPush } from '@/lib/pushClient'

interface Props {
  memberId: string
  className?: string
}

export default function PushNotificationPrompt({ memberId, className = '' }: Props) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [isIosNotPwa, setIsIosNotPwa] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    // 1. Service Worker registrieren
    registerServiceWorker()

    // 2. iOS PWA Check
    if (typeof window !== 'undefined') {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true

      if (isIos && !isStandalone) {
        setIsIosNotPwa(true)
      }

      if (!('Notification' in window) || !('PushManager' in window)) {
        if (!isIos) {
          setPermission('unsupported')
        }
        return
      }

      setPermission(Notification.permission)

      // Falls bereits erlaubt: Im Hintergrund sicherstellen, dass Subscription in Supabase aktuell ist
      if (Notification.permission === 'granted') {
        subscribeToPush(memberId).catch(() => {})
      }
    }
  }, [memberId])

  const handleEnable = async () => {
    setIsLoading(true)
    try {
      const success = await subscribeToPush(memberId)
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission)
      }
      if (success) {
        setIsSuccess(true)
        setTimeout(() => setIsSuccess(false), 4000)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  // Wenn bereits erlaubt und kein Erfolgs-Feedback gerade aktiv ist, unauffällig bleiben
  if (permission === 'granted' && !isSuccess) {
    return null
  }

  if (isIosNotPwa) {
    return (
      <div
        className={`w-full max-w-sm mx-auto p-4 rounded-xl border text-left ${className}`}
        style={{
          background: 'rgba(20, 20, 20, 0.7)',
          borderColor: 'rgba(200, 160, 101, 0.25)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex items-start gap-3">
          <span className="text-lg" style={{ color: '#c8a065' }}>
            ∿
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] mb-1" style={{ color: '#e8e4de' }}>
              Push auf dem iPhone
            </p>
            <p className="text-xs leading-relaxed" style={{ color: '#8c857e' }}>
              Tippe im Safari-Menü auf <strong className="text-zinc-300">Teilen</strong> (⎙) und wähle{' '}
              <strong className="text-zinc-300">„Zum Home-Bildschirm“</strong>, um Push-Benachrichtigungen zu
              aktivieren.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className={`text-center text-xs tracking-wider ${className}`} style={{ color: '#6b6560' }}>
        Benachrichtigungen sind im Browser blockiert.
      </div>
    )
  }

  if (permission === 'unsupported') {
    return null
  }

  if (isSuccess) {
    return (
      <div
        className={`w-full max-w-sm mx-auto p-3 rounded-xl border text-center animate-fade-in ${className}`}
        style={{
          background: 'rgba(30, 25, 18, 0.8)',
          borderColor: 'rgba(200, 160, 101, 0.4)',
        }}
      >
        <p className="text-xs tracking-widest uppercase font-medium" style={{ color: '#c8a065' }}>
          ✓ Push-Benachrichtigungen aktiv
        </p>
      </div>
    )
  }

  return (
    <div
      className={`w-full max-w-sm mx-auto p-4 rounded-xl border text-center animate-fade-in ${className}`}
      style={{
        background: 'rgba(18, 18, 18, 0.75)',
        borderColor: 'rgba(200, 160, 101, 0.2)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <p className="text-xs font-medium uppercase tracking-[0.18em] mb-1" style={{ color: '#e8e4de' }}>
        Nichts verpassen
      </p>
      <p className="text-xs leading-relaxed mb-3.5" style={{ color: '#8c857e' }}>
        Erhalte ein Signal, sobald eine neue Welle beginnt oder alle geantwortet haben.
      </p>
      <button
        onClick={handleEnable}
        disabled={isLoading}
        className="w-full py-2.5 px-4 rounded-lg text-xs tracking-[0.2em] uppercase font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        style={{
          background: '#c8a065',
          color: '#0a0a0a',
        }}
      >
        {isLoading ? 'Aktivieren...' : 'Push-Benachrichtigungen an'}
      </button>
    </div>
  )
}
