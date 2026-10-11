import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const publicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BP74Vf6fz3p_eAlhZWAMPkS0UU-PS8WYfDCZUesMaTKOZqKXtXyAafKsnpGFgNggxuafj4Q67BF2ZpNRJDn5N2I'
const privateKey =
  process.env.VAPID_PRIVATE_KEY ||
  'hd14eA3D5dVg9YW2scgESbqe2P_iMr3VPUGwSGkoUSM'
const subject = process.env.VAPID_SUBJECT || 'mailto:support@welle-nu.vercel.app'

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function sendPushToMembers(options: {
  memberIds?: string[]
  excludeMemberId?: string
  payload: PushPayload
}) {
  if (!publicKey || !privateKey) {
    console.warn('[Push] VAPID keys not configured, skipping push notification.')
    return { sent: 0, failed: 0 }
  }

  let query = supabase.from('push_subscriptions').select('*')
  if (options.memberIds && options.memberIds.length > 0) {
    query = query.in('member_id', options.memberIds)
  }
  if (options.excludeMemberId) {
    query = query.neq('member_id', options.excludeMemberId)
  }

  const { data: subscriptions, error } = await query
  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 }
  }

  // Dedupliziere Subscriptions: Pro Mitglied und Provider-Origin (z.B. Apple, Google) nur die aktuellste Subscription verwenden
  const validSubscriptions: typeof subscriptions = []
  const obsoleteEndpoints: string[] = []
  const seenKeys = new Set<string>()

  // Sortiere absteigend nach Aktualität (neueste zuerst)
  const sortedSubs = [...subscriptions].sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at || 0).getTime()
    const timeB = new Date(b.updated_at || b.created_at || 0).getTime()
    return timeB - timeA
  })

  for (const sub of sortedSubs) {
    let origin = 'unknown'
    try {
      origin = new URL(sub.endpoint).origin
    } catch {
      origin = sub.endpoint.split('/')[2] || 'unknown'
    }

    const key = `${sub.member_id}:${origin}`
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      validSubscriptions.push(sub)
    } else {
      obsoleteEndpoints.push(sub.endpoint)
    }
  }

  let sent = 0
  let failed = 0
  const expiredEndpoints: string[] = [...obsoleteEndpoints]

  const payloadString = JSON.stringify(options.payload)

  await Promise.allSettled(
    validSubscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }

      try {
        await webpush.sendNotification(pushSubscription, payloadString, {
          TTL: 86400,
          urgency: 'high',
        })
        sent++
      } catch (err: any) {
        failed++
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint)
        } else {
          console.error('[Push] Send error for endpoint:', sub.endpoint, err.message)
        }
      }
    })
  )

  if (expiredEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }

  return { sent, failed }
}
