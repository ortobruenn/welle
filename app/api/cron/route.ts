import { NextResponse } from 'next/server'
import { activateWaveInternal } from '@/lib/waveService'

export const maxDuration = 60

export async function GET() {
  return handleCron()
}

export async function POST() {
  return handleCron()
}

async function handleCron() {
  try {
    const result = await activateWaveInternal(false)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[Cron] Error checking waves:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
