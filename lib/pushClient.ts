function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return registration
  } catch (error) {
    console.warn('[SW] Registration failed:', error)
    return null
  }
}

export async function subscribeToPush(memberId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false

  const vapidPublicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    'BP74Vf6fz3p_eAlhZWAMPkS0UU-PS8WYfDCZUesMaTKOZqKXtXyAafKsnpGFgNggxuafj4Q67BF2ZpNRJDn5N2I'

  try {
    // 1. Zuerst sofort im User-Gesture die Berechtigung anfragen
    if (!('Notification' in window)) {
      console.warn('[Push] Notification API not supported')
      return false
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('[Push] Notification permission denied:', permission)
      return false
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] PushManager not supported')
      return false
    }

    // 2. Service Worker registrieren falls noch nicht aktiv
    await registerServiceWorker()

    // 3. Mit Timeout auf ready warten (verhindert Hänger)
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
    const registration = (await Promise.race([navigator.serviceWorker.ready, timeoutPromise])) as ServiceWorkerRegistration | null

    if (!registration || !registration.pushManager) {
      console.warn('[Push] ServiceWorker ready timed out')
      return false
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
    }

    // 4. An Supabase Backend schicken
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        memberId,
      }),
    })

    return res.ok
  } catch (error) {
    console.error('[Push] Failed to subscribe to push:', error)
    return false
  }
}
