import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
  try {
    const { subscription, memberId } = await req.json()

    if (!subscription || !subscription.endpoint || !memberId) {
      return NextResponse.json({ error: 'Missing subscription or memberId' }, { status: 400 })
    }

    const { endpoint, keys } = subscription
    if (!keys || !keys.p256dh || !keys.auth) {
      return NextResponse.json({ error: 'Invalid subscription keys' }, { status: 400 })
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        member_id: memberId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )

    if (error) {
      console.error('[Push] Upsert subscription error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Push] Subscribe route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
