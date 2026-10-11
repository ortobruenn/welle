import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { POST as generateWavePost } from '@/app/api/generate-wave/route'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET() {
  return handleCron()
}

export async function POST() {
  return handleCron()
}

async function handleCron() {
  try {
    const { data: waves, error } = await supabase
      .from('waves')
      .select('*')
      .order('number', { ascending: false })
      .limit(1)

    if (error || !waves || waves.length === 0) {
      return NextResponse.json({ message: 'No waves found' })
    }

    const currentWave = waves[0]

    // Prüfen, ob die Welle im Cooldown ist und die Zeit abgelaufen ist
    if (currentWave.status === 'cooldown' && currentWave.next_wave_at) {
      const isTimeUp = new Date(currentWave.next_wave_at).getTime() <= Date.now()
      if (isTimeUp) {
        // Nächste Welle generieren (löst intern auch Web-Push an alle aus)
        const mockReq = new Request('http://localhost/api/generate-wave', {
          method: 'POST',
          body: JSON.stringify({ force: false }),
        })
        const response = await generateWavePost(mockReq)
        const result = await response.json()
        return NextResponse.json({ triggered: true, result })
      }
    }

    return NextResponse.json({
      triggered: false,
      status: currentWave.status,
      next_wave_at: currentWave.next_wave_at,
    })
  } catch (err: any) {
    console.error('[Cron] Error checking waves:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
