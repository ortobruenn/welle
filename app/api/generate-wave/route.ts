import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const geminiApiKey = process.env.GEMINI_API_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

// Bunter, vielseitiger Pool aus allen Erlebnis-Formaten
const CURATED_PROMPTS = [
  // ZEICHNEN 🎨
  { prompt: 'Zeichne mit einem Strich ein Symbol, das deinen heutigen Tag einfängt.', prompt_type: 'draw', options: null },
  { prompt: 'Zeichne blind ein Tier mit drei Beinen.', prompt_type: 'draw', options: null },
  { prompt: 'Skizziere kurz die Form einer Wolke, die heute über dir sein könnte.', prompt_type: 'draw', options: null },
  
  // FOTO & TEXTUR 📷
  { prompt: 'Finde etwas in deiner unmittelbaren Umgebung, das rot oder rostig ist.', prompt_type: 'photo', options: null },
  { prompt: 'Ein Blick aus deinem nächsten Fenster – zeig uns den Himmel über deiner Stadt.', prompt_type: 'photo', options: null },
  { prompt: 'Fotografiere eine Textur (Holz, Beton, Stoff, Kaffeeschaum), die du heute berührt hast.', prompt_type: 'photo', options: null },

  // PULS & RESONANZ ∿
  { prompt: 'Schließe für einen Atemzug die Augen und halte das Wellen-Symbol berührt.', prompt_type: 'pulse', options: null },
  { prompt: 'Ein gemeinsamer Puls über die Distanz. Berühre das Zentrum für 10 Sekunden.', prompt_type: 'pulse', options: null },

  // STILLE & ACHTSAMKEIT 🧘
  { prompt: 'Nimm dir 20 Sekunden vollkommene Stille. Lass das Rauschen der Welt kurz verblassen.', prompt_type: 'silence', options: null },

  // WORT-KETTE ⛓️
  { prompt: 'Kettenreaktion: Schreibe genau EIN einziges Wort für das gemeinsame Satz-Mosaik.', prompt_type: 'chain', options: null },

  // DILEMMA & ENTSCHEIDUNG 🎲
  { prompt: 'Dilemma: Eher ein Jahr lang jeden Tag derselbe Song oder nie wieder Musik hören?', prompt_type: 'choice', options: ['Jeden Tag derselbe Song', 'Nie wieder Musik'] },
  { prompt: 'Entscheidung: Spontaner Nachtspaziergang durch die Stadt oder am Kamin einschlafen?', prompt_type: 'choice', options: ['Nachtspaziergang', 'Kaminfeuer'] },
  { prompt: 'Entscheidung: Zeitreisen 100 Jahre in die Vergangenheit oder 100 Jahre in die Zukunft?', prompt_type: 'choice', options: ['100 Jahre Vergangenheit', '100 Jahre Zukunft'] },

  // TIEFSINN & GEDANKEN ✍️
  { prompt: 'Was war der unscheinbarste Glücksmoment deines heutigen Tages?', prompt_type: 'text', options: null },
  { prompt: 'Wofür bist du heute dankbar, das man nicht kaufen kann?', prompt_type: 'text', options: null },
  { prompt: 'Was hat dich heute für einen Augenblick zum Schmunzeln gebracht?', prompt_type: 'text', options: null },
]

export async function POST() {
  try {
    // 1. Vorherige Wellen holen
    const { data: previousWaves } = await supabase
      .from('waves')
      .select('number, prompt, responses(content)')
      .order('number', { ascending: false })
      .limit(5)

    const nextNumber = previousWaves && previousWaves.length > 0
      ? Math.max(...previousWaves.map(w => w.number)) + 1
      : 1

    let contextText = ''
    if (previousWaves && previousWaves.length > 0) {
      contextText = 'Bisherige Wellen und Antworten der Gruppe:\n' + previousWaves.map(w => {
        const respList = (w.responses || []).map((r: any) => `"${r.content}"`).join(', ')
        return `Welle ${w.number}: Frage "${w.prompt}" | Antworten: [${respList}]`
      }).join('\n')
    }

    const systemPrompt = `Du bist die mysteriöse, poetische und verbindende Intelligenz einer privaten Web-App namens "Welle".
Die Nutzer sind 4 gute Freunde, die in einer gemeinsamen IT-Umschulung lernen, sich täglich unterstützen, aber im Alltag getrennt leben.
Deine Aufgabe ist es, die NÄCHSTE "Welle" (einen Prompt/eine Frage/eine kleine Reflexionsaufgabe) zu generieren.

Regeln:
1. Der Ton soll minimalistisch, warmherzig, poetisch, aber geerdet sein (kein Kitsch).
2. Es soll die Menschen miteinander verbinden, zum Nachdenken oder Schmunzeln anregen.
3. Beziehe dich subtil auf frühere Stimmungen oder Antworten der Gruppe, falls vorhanden.
4. Manchmal offene Textfragen, manchmal eine überraschende A/B-Entscheidung ("choice").
5. Halte die Frage kurz und prägnant (maximal 1-2 Sätze).
6. Gib AUSSCHLIESSLICH ein valides JSON-Objekt zurück:
{
  "prompt": "Deine Frage hier",
  "prompt_type": "text",
  "options": null
}`

    let parsed: any = null

    // 2. Primär: Gemini 3.5-flash-lite aufrufen (hat sehr hohes Quota)
    if (geminiApiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemPrompt}\n\n${contextText}\n\nGeneriere jetzt Welle ${nextNumber}. Antworte nur mit reinem JSON.` }
                ]
              }
            ]
          })
        })

        if (response.ok) {
          const data = await response.json()
          let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
          parsed = JSON.parse(rawText)
        }
      } catch (e) {
        console.warn('Gemini generation failed, falling back to smart curated pool:', e)
      }
    }

    // 3. Intelligenter Pool-Fallback: Wähle eine Frage, die noch NIE gestellt wurde!
    if (!parsed || !parsed.prompt) {
      const pastPrompts = (previousWaves || []).map(w => w.prompt)
      const available = CURATED_PROMPTS.filter(p => !pastPrompts.includes(p.prompt))
      parsed = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : CURATED_PROMPTS[nextNumber % CURATED_PROMPTS.length]
    }

    // 4. Neue Welle in Supabase speichern
    const { data: newWave, error: insertError } = await supabase
      .from('waves')
      .insert({
        number: nextNumber,
        prompt: parsed.prompt,
        prompt_type: parsed.prompt_type || 'text',
        options: parsed.options || null,
        status: 'active',
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ success: true, wave: newWave })
  } catch (error: any) {
    console.error('Error in generate-wave:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
