import { NextResponse, after } from 'next/server'
import { prepareWaveContent, activateWaveInternal } from '@/lib/waveService'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const force = !!body?.force
    const prepareOnly = !!body?.prepareOnly
    const targetWaveId = body?.waveId
    const nextWaveAt = body?.nextWaveAt

    // -------------------------------------------------------------
    // MODUS A: PRE-GENERATE IM HINTERGRUND WÄHREND DES COOLDOWNS
    // -------------------------------------------------------------
    if (prepareOnly) {
      const prepResult = await prepareWaveContent(targetWaveId)
      if (!prepResult.success) {
        return NextResponse.json({ error: 'Wave not found' }, { status: 404 })
      }

      // Prüfen, ob ein Cooldown-Ablaufzeitpunkt vorliegt
      const targetTimeStr = nextWaveAt || prepResult.wave?.next_wave_at
      let autoScheduled = false

      if (targetTimeStr) {
        const targetTime = new Date(targetTimeStr).getTime()
        const remainingMs = targetTime - Date.now()

        // Für Cooldowns im Rahmen des Lambda-Lifecycles (z.B. Testmodus <= 45s)
        // halten wir die Serverless-Instanz via after() wach, sodass Push punktgenau bei 00:00 ankommt!
        if (remainingMs > 0 && remainingMs <= 45_000) {
          autoScheduled = true
          after(async () => {
            const delay = Math.max(0, targetTime - Date.now() + 150)
            if (delay > 0) {
              await new Promise(r => setTimeout(r, delay))
            }
            console.log('[Wave] Auto-activating wave after timer expired...')
            await activateWaveInternal(false).catch(err => {
              console.error('[Wave] Auto-activation error:', err)
            })
          })
        } else if (remainingMs <= 0) {
          // Bereits abgelaufen -> sofort aktivieren
          after(async () => {
            await activateWaveInternal(false).catch(() => {})
          })
        }
      }

      return NextResponse.json({
        success: true,
        prepared: true,
        autoScheduled,
      })
    }

    // -------------------------------------------------------------
    // MODUS B: DIREKTE AKTIVIERUNG
    // -------------------------------------------------------------
    const result = await activateWaveInternal(force)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error in generate-wave POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
