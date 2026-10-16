import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  extractEcho,
  attachEchoToOptions,
  parseSpectrumResponse,
  parseChallengeResponse,
  extractUndercover,
  cleanOptions,
} from '@/lib/mystery'
import { sendPushToMembers } from '@/lib/pushServer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const geminiApiKey = process.env.GEMINI_API_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

function buildDynamicFallbackEcho(
  wave: any,
  responseList: Array<{ content: string; member_id: string; members?: { name?: string } }>
): string {
  if (
    wave.prompt_type === 'memory' ||
    wave.prompt_type === 'logic' ||
    wave.prompt_type === 'scramble'
  ) {
    const parsed = responseList.map(r => parseChallengeResponse(r.content))
    const passed = parsed.filter(p => p.passed)
    const failed = parsed.filter(p => !p.passed)
    if (passed.length === responseList.length) {
      const best = Math.min(...passed.map(p => p.timeMs))
      return `Kein einziges Trostpflaster verteilt – mit einer Bestzeit von ${(best / 1000).toFixed(1).replace('.', ',')}s waren heute alle Synapsen hellwach.`
    }
    if (passed.length === 0) {
      return `Kollektiver Kurzschluss unter Zeitdruck: Heute geht die gesamte Runde geschlossen mit dem offiziellen Trostpflaster nach Hause.`
    }
    return `${passed.length}× kühler Kopf in der Ruhmeshalle, ${failed.length}× das ehrliche Trostpflaster – unter 35-Sekunden-Druck zeigt sich, wer die Nerven behält.`
  }

  if (wave.prompt_type === 'spectrum') {
    const poles = cleanOptions(wave.options)
    const vals = responseList.map(r => parseSpectrumResponse(r.content).self)
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    const spread = Math.max(...vals) - Math.min(...vals)
    if (spread <= 15) {
      return `Fast unheimliche Synchronizität bei ${avg}% – heute schwingt ihr auf exakt derselben Frequenz.`
    }
    if (spread >= 60 && poles && poles.length >= 2) {
      return `Kompletter Spagat zwischen „${poles[0]}“ und „${poles[1]}“ (${Math.min(...vals)}% bis ${Math.max(...vals)}%) – langweilig wird es mit euch definitiv nicht.`
    }
    return `Mit einem Gruppenschnitt von ${avg}% pendelt ihr euch heute genau zwischen den Extremen ein.`
  }

  if (wave.prompt_type === 'draw') {
    return `35 Sekunden, ein leerer Screen und ${responseList.length} völlig eigene Kunstwerke – man erkennt euren Strich sofort.`
  }

  if (wave.prompt_type === 'photo') {
    return `${responseList.length} ungefilterte Blickwinkel aus demselben Moment – jeder sieht heute eine andere Welt.`
  }

  // Text / Undercover: Zitiere echte Fragmente aus den Antworten!
  const textSnippets = responseList
    .map(r => (r.content || '').trim())
    .filter(t => t && !t.startsWith('data:image/'))
    .map(t => (t.length > 38 ? t.slice(0, 35).trim() + '…' : t))

  if (textSnippets.length >= 2) {
    return `Zwischen „${textSnippets[0]}“ und „${textSnippets[1]}“ zeigt sich heute wieder eure ganze Bandbreite.`
  }
  if (textSnippets.length === 1) {
    return `„${textSnippets[0]}“ setzt heute den Ton für diese Runde.`
  }

  return 'Unterschiedlicher hätten die Impulse kaum ausfallen können – genau das macht eure Runde aus.'
}

async function generateAIEcho(systemPrompt: string): Promise<string | null> {
  // 1. Primär: Google Gemini API (wenn ein gültiger AIza... Key hinterlegt ist)
  if (geminiApiKey && geminiApiKey.startsWith('AIza')) {
    for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { temperature: 0.85 },
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
          if (text) {
            return text.replace(/^["„“]/, '').replace(/["„“]$/, '').trim()
          }
        } else {
          const errText = await res.text().catch(() => '')
          console.warn(`[Echo] Gemini (${model}) HTTP ${res.status}:`, errText.slice(0, 200))
        }
      } catch (err) {
        console.warn(`[Echo] Gemini (${model}) error:`, err)
      }
    }
  } else if (geminiApiKey) {
    console.warn(
      '[Echo] Hinweis: GEMINI_API_KEY in .env.local beginnt nicht mit "AIza" (ungültiges Google AI Studio Key-Format). Nutze KI-Fallback.'
    )
  }

  // 2. Automatischer KI-Fallback (OpenAI-kompatibler Endpunkt via Pollinations Text AI)
  try {
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [
          {
            role: 'system',
            content:
              'Du bist die schlagfertige, feinsinnige Stimme der Freundschafts-App "Welle". Du antwortest immer direkt auf Deutsch mit genau 1 bis 2 pointierten Sätzen ohne Anführungszeichen.',
          },
          { role: 'user', content: systemPrompt },
        ],
        temperature: 0.85,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content?.trim()
      if (text && text.length > 10) {
        return text.replace(/^["„“]/, '').replace(/["„“]$/, '').trim()
      }
    }
  } catch (err) {
    console.warn('[Echo] Secondary AI endpoint failed:', err)
  }

  return null
}

export async function POST(req: Request) {
  let waveId: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    waveId = body?.waveId
    if (!waveId) {
      return NextResponse.json({ error: 'Missing waveId' }, { status: 400 })
    }

    const { data: wave, error: waveError } = await supabase
      .from('waves')
      .select('*')
      .eq('id', waveId)
      .single()

    if (waveError || !wave) {
      return NextResponse.json({ error: 'Wave not found' }, { status: 404 })
    }

    const existingEcho = extractEcho(wave.options)
    const isLocked = wave.options?.some(
      (o: string) => o === '__echo_locked__' || o === '__reveal_push_sent__'
    )
    if (existingEcho || isLocked) {
      return NextResponse.json({ success: true, echo: existingEcho, alreadyDispatched: true })
    }

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

    const responseList = (responses || []) as any[]
    if (responseList.length === 0) {
      return NextResponse.json({ success: false, message: 'No responses yet' })
    }

    const undercover = wave.prompt_type === 'undercover' ? extractUndercover(wave.options) : null
    const poles = cleanOptions(wave.options)

    const answersSummary = responseList
      .map((r: any) => {
        const author = r.members?.name || 'Freund'
        if ((r.content || '').startsWith('data:image/')) {
          return `${author}: [Hat ${wave.prompt_type === 'photo' ? 'ein Live-Foto' : 'eine 35-Sekunden-Skizze'} eingereicht]`
        }
        if (
          wave.prompt_type === 'memory' ||
          wave.prompt_type === 'logic' ||
          wave.prompt_type === 'scramble'
        ) {
          const chal = parseChallengeResponse(r.content || '')
          return `${author}: ${
            chal.passed ? 'GESCHAFFT (Ruhmeshalle)' : 'GESCHEITERT (Trostpflaster 🩹)'
          } – ${chal.detail}`
        }
        if (wave.prompt_type === 'spectrum') {
          const spec = parseSpectrumResponse(r.content || '')
          const poleInfo =
            poles && poles.length >= 2
              ? ` (0% = "${poles[0]}", 100% = "${poles[1]}")`
              : ''
          return `${author}: Eigener Wert ${spec.self}%${poleInfo}, Schätzung für den Gruppenschnitt: ${spec.guessAvg}%`
        }
        const moleTag =
          undercover && undercover.memberId === r.member_id
            ? ` (WAR DER HEIMLICHE MAULWURF mit dem Sabotage-Auftrag: "${undercover.prompt}")`
            : ''
        return `${author}${moleTag}: "${r.content}"`
      })
      .join('\n')

    const prompt = `Eine enge Freundesgruppe hat in der App "Welle" auf folgende Frage geantwortet:
Format: ${wave.prompt_type}
Frage an die Gruppe: "${wave.prompt}"

Konkrete Antworten der Freunde:
${answersSummary}

Deine Aufgabe:
Verfasse ein kurzes, treffendes, witziges oder feinsinniges "Echo der Welle" (exakt 1 bis maximal 2 Sätze).
WICHTIG:
- Gehe DIREKT und KONKRET auf den Inhalt der obigen Antworten ein (greife Details, absurde Gegensätze, genannte Begriffe oder Zahlen aus den Antworten auf!).
- Keine generischen Floskeln, die auf jede beliebige Runde passen würden!
- Nenne keine Klarnamen, sondern spiele direkt mit den Inhalten (z.B. "Wenn der eine von X träumt, während der andere...").
- Antworte NUR mit dem reinen Echo-Text ohne Anführungszeichen.`

    let synthesizedEcho = await generateAIEcho(prompt)

    if (!synthesizedEcho) {
      synthesizedEcho = buildDynamicFallbackEcho(wave, responseList)
    }

    // Re-read latest options so concurrent reactions/votes aren't overwritten
    const { data: freshWave } = await supabase
      .from('waves')
      .select('options')
      .eq('id', waveId)
      .single()

    const baseOptions = freshWave?.options || wave.options || []
    const updatedOptions = attachEchoToOptions(baseOptions, synthesizedEcho)
    const finalOptions = [
      ...updatedOptions.filter((o: string) => o !== '__echo_locked__'),
      '__reveal_push_sent__',
    ]

    const { error: updateError } = await supabase
      .from('waves')
      .update({ options: finalOptions })
      .eq('id', waveId)

    if (updateError) throw updateError

    try {
      await sendPushToMembers({
        payload: {
          title: `Welle #${wave.number} enthüllt ∿`,
          body: 'Alle sind da! Sieh dir die Antworten an und gib deinen Tipp ab.',
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
        const { data: cur } = await supabase
          .from('waves')
          .select('options')
          .eq('id', waveId)
          .single()
        if (cur?.options) {
          const clean = cur.options.filter((o: string) => o !== '__echo_locked__')
          await supabase.from('waves').update({ options: clean }).eq('id', waveId)
        }
      } catch {}
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
