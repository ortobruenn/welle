import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractEcho, attachEchoToOptions } from '@/lib/mystery'
import { sendPushToMembers } from '@/lib/pushServer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const geminiApiKey = process.env.GEMINI_API_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

const FALLBACK_ECHOES = [
  'Zwei von euch suchten heute die Ferne, während einer den Anker im Stillen warf.',
  'Eure Gedanken kreisen umeinander wie Schatten im Zwielicht – nah, doch jeder in seiner eigenen Welt.',
  'Ein ungesprochener Konsens schwingt zwischen euren Worten. Die Resonanz ist tief, aber verborgen.',
  'Dort, wo Worte enden, haben eure Spuren heute ein unsichtbares Muster gezeichnet.',
  'Einer tanzte aus der Reihe, doch gerade dieser Bruch hielt das Gleichgewicht der Welle.',
  'Ihr blickt aus verschiedenen Fenstern in denselben Himmel. Die Frequenz bleibt synchron.',
  'Die Kontraste eurer Antworten offenbaren das Geheimnis: Vollständigkeit entsteht nur im Widerspruch.'
]

export async function POST(req: Request) {
  try {
    const { waveId } = await req.json()
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

    // Prüfen, ob bereits ein Echo existiert
    const existingEcho = extractEcho(wave.options)
    if (existingEcho) {
      return NextResponse.json({ success: true, echo: existingEcho })
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

        const prompt = `Du bist das uralte, poetische Orakel der Web-App "Welle".
Die Gruppe (enge Freunde) hat auf folgende Welle geantwortet:
Frage: "${wave.prompt}"
Antworten der Freunde:
${answersSummary}

Aufgabe:
Formuliere ein einzelnes, tiefsinniges, geheimnisvolles "Echo der Welle" (exakt 1 bis maximal 2 Sätze).
Beobachte die kollektive Stimmung, Gegensätze oder verborgene Harmonien.
Regeln:
- Nicht kitschig, sondern mysteriös, poetisch, ruhig und treffsicher.
- Nenne keine Namen direkt, sondern sprich von "Zwei von euch...", "Einer...", "Eure Resonanz...".
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
    await supabase
      .from('waves')
      .update({ options: updatedOptions })
      .eq('id', waveId)

    // Web Push: Enthüllung an alle Mitglieder melden
    try {
      await sendPushToMembers({
        payload: {
          title: 'Welle enthüllt ∿',
          body: 'Alle haben geantwortet! Sieh dir an, was entstanden ist.',
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
