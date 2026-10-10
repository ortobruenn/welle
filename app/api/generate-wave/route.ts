import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const geminiApiKey = process.env.GEMINI_API_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST() {
  try {
    // 1. Hole vorherige Wellen und Antworten als Kontext für die KI
    const { data: previousWaves } = await supabase
      .from('waves')
      .select('number, prompt, responses(content)')
      .order('number', { ascending: false })
      .limit(3)

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
1. Der Ton soll minimalistisch, warmherzig, poetisch, aber geerdet sein (kein Kitsch, kein Tech-Geschwätz).
2. Es soll die Menschen miteinander verbinden, zum Nachdenken oder Schmunzeln anregen.
3. Beziehe dich subtil auf frühere Stimmungen oder Antworten der Gruppe, falls vorhanden.
4. Manchmal offene Textfragen (z.B. Beobachtungen im Alltag, Momente, Gedanken), manchmal eine überraschende A/B-Entscheidung.
5. Halte die Frage kurz und prägnant (maximal 1-2 Sätze).
6. Gib AUSSCHLIESSLICH ein valides JSON-Objekt im folgenden Format zurück:
{
  "prompt": "Deine Frage hier",
  "prompt_type": "text", // oder "choice"
  "options": null // oder ["Option A", "Option B"] falls prompt_type "choice" ist
}`

    // Gemini API Request (gemini-3.8-flash)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiApiKey}`

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

    const data = await response.json()
    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // JSON sauber parsen
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
    
    let parsed
    try {
      parsed = JSON.parse(rawText)
    } catch {
      parsed = {
        prompt: 'Was hat dich heute für einen kurzen Augenblick innehalten lassen?',
        prompt_type: 'text',
        options: null
      }
    }

    // Neue Welle in Supabase speichern
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

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({ success: true, wave: newWave })
  } catch (error: any) {
    console.error('Error generating wave:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
