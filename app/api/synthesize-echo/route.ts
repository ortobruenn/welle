import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractEcho, attachEchoToOptions } from '@/lib/mystery'
import { sendPushToMembers } from '@/lib/pushServer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const geminiApiKey = process.env.GEMINI_API_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

const FALLBACK_ECHOES = [
  'Während hier jemand schon im Feierabend-Koma liegt, retten die anderen noch die Welt.',
  'Unterschiedlicher hätten die Antworten kaum ausfallen können – und genau deshalb funktioniert die Runde.',
  'Einer tanzt komplett aus der Reihe, der Rest nickt zustimmend. Perfekte Balance.',
  'Ein fast schon verdächtiger Gleichklang. Entweder herrscht hier Telepathie, oder ihr braucht dringend Kaffee.',
  'Gleicher Tag, völlig andere Welten in euren Köpfen. Herrlich normal.',
  'Dort, wo Worte kurz innehalten, treffen sich eure Gedanken ganz ungeplant.',
  'Halb herrlich absurdes Chaos, halb echter Tiefgang: Die ehrlichste Momentaufnahme des Tages.',
  'Zwei völlig konträre Blickwinkel – und beide haben auf ihre Art absolut recht.'
]

export async function POST(req: Request) {
  let waveId: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    waveId = body?.waveId
    if (!waveId) {
      return NextResponse.json({ error: 'Missing waveId' }, { status: 400 })
    }

    // 1. Hole Welle und Antworten
    const { data: wave, error: waveError } = await supabase
      .from('waves')
      .select('*')
      .eq('id', waveId)
      .single()

    if (waveError || !wave) {
      return NextResponse.json({ error: 'Wave not found' }, { status: 404 })
    }

    // Prüfen, ob bereits ein Echo existiert oder gerade generiert wird / Push bereits gesendet wurde
    const existingEcho = extractEcho(wave.options)
    const isLocked = wave.options?.some((o: string) => o === '__echo_locked__' || o === '__reveal_push_sent__')
    if (existingEcho || isLocked) {
      return NextResponse.json({ success: true, echo: existingEcho, alreadyDispatched: true })
    }

    // Atomare Sperre in Supabase setzen
    const lockOptions = [...(wave.options || []), '__echo_locked__']
    const { data: claimed } = await supabase
      .from('waves')
      .update({ options: lockOptions })
      .eq('id', waveId)
      .eq('status', 'reveal')
      .select()

    if (!claimed || claimed.length === 0) {
      return NextResponse.json({ success: true, inProgressOrDone: true })
    }

    const { data: responses } = await supabase
      .from('responses')
      .select('content, member_id, members(name)')
      .eq('wave_id', waveId)

    const responseList = responses || []
    if (responseList.length === 0) {
      return NextResponse.json({ success: false, message: 'No responses yet' })
    }

    let synthesizedEcho = ''

    // 2. Primär: Gemini 3.5-flash-lite
    if (geminiApiKey) {
      try {
        const answersSummary = responseList
          .map((r: any) => {
            const author = r.members?.name || 'Jemand'
            const preview = (r.content || '').startsWith('data:image/')
              ? '[Ein visuelles Bild / eine Skizze]'
              : r.content
            return `${author}: "${preview}"`
          })
          .join('\n')

        const prompt = `Du bist die feinsinnige, schlagfertige und verbindende Stimme der Web-App "Welle".
Eine Gruppe enger Freunde hat auf folgende Welle geantwortet:
Frage: "${wave.prompt}"
Antworten der Freunde:
${answersSummary}

Aufgabe:
Formuliere ein einzelnes, treffendes "Echo der Welle" (exakt 1 bis maximal 2 Sätze).
Spiegle die Gruppendynamik, Kontraste oder verborgene Harmonien wider.

STRENGE REGELN:
1. TONALITÄT ANTWORT-ADAPTIV:
   - Passe deinen Tonfall dynamisch an die Antworten an: Sind die Antworten witzig, frech oder alltäglich, formuliere pfiffig, locker, trocken oder humorvoll mit einem Augenzwinkern! Sind die Antworten nachdenklich, sei warm, atmosphärisch und feinfühlig.
   - Vermeide kitschiges Schwulst-Pathos, Endzeit-Düsternis oder ständige pseudo-mystische Schwere.
2. KEINE ZAHLENFIXIERUNG:
   - Erwähne NIEMALS die Zahl "vier" oder Floskeln wie "ihr vier", "alle vier"!
   - Nenne keine echten Namen, sondern beziehe dich charmant und lebendig auf die Dynamik (z.B. "Während hier jemand...", "Einer tanzt komplett aus der Reihe...", "Gleichstand zwischen Chaos und Tiefsinn...").
3. FORMAT:
   - Exakt 1 bis maximal 2 Sätze.
   - Antworte NUR mit dem reinen Echo-Satz ohne Anführungszeichen, ohne Einleitung.`

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        })

        if (res.ok) {
          const data = await res.json()
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
          if (text) {
            synthesizedEcho = text.replace(/^["„“]/, '').replace(/["„“]$/, '').trim()
          }
        }
      } catch (err) {
        console.warn('Gemini echo synthesis failed, using fallback:', err)
      }
    }

    // 3. Fallback
    if (!synthesizedEcho) {
      synthesizedEcho = FALLBACK_ECHOES[Math.floor(Math.random() * FALLBACK_ECHOES.length)]
    }

    // 4. In Supabase speichern
    const updatedOptions = attachEchoToOptions(wave.options, synthesizedEcho)
    const finalOptions = [...updatedOptions.filter(o => o !== '__echo_locked__'), '__reveal_push_sent__']
    const { error: updateError } = await supabase
      .from('waves')
      .update({ options: finalOptions })
      .eq('id', waveId)

    if (updateError) throw updateError

    // Web Push: Alle haben geantwortet -> Genau einmal an alle Teilnehmer melden!
    try {
      await sendPushToMembers({
        payload: {
          title: 'Welle enthüllt ∿',
          body: 'Alle Teilnehmer haben geantwortet! Sieh dir an, was entstanden ist.',
          url: '/',
          tag: `reveal-${waveId}`,
        },
      })
    } catch (pushErr) {
      console.warn('[Push] Failed to dispatch reveal push:', pushErr)
    }

    return NextResponse.json({ success: true, echo: synthesizedEcho })
  } catch (error: any) {
    console.error('Error in synthesize-echo:', error)
    if (waveId) {
      try {
        const { data: cur } = await supabase.from('waves').select('options').eq('id', waveId).single()
        if (cur?.options) {
          const clean = cur.options.filter((o: string) => o !== '__echo_locked__')
          await supabase.from('waves').update({ options: clean }).eq('id', waveId)
        }
      } catch {}
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
