import { NextResponse } from 'next/server'
import { sendPushToMembers } from '@/lib/pushServer'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const result = await sendPushToMembers({
      memberIds: body.memberId ? [body.memberId] : undefined,
      payload: {
        title: body.title || 'Welle Signal ∿',
        body: body.body || 'Das Signal ist angekommen. Push-Benachrichtigungen funktionieren einwandfrei.',
        url: '/',
      },
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    console.error('[Push] Test route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
