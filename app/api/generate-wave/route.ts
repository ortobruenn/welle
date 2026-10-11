import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { attachGlitchToOptions, buildEnigmaOptions, buildVibeOptions } from '@/lib/mystery'
import { sendPushToMembers } from '@/lib/pushServer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const geminiApiKey = process.env.GEMINI_API_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

// Bunter, vielseitiger Pool aus allen Erlebnis-Formaten inklusive Glitch-Varianten
const CURATED_PROMPTS = [
  // ZEICHNEN 🎨
  {
    prompt: 'Zeichne mit einem Strich ein Symbol, das deinen heutigen Tag einfängt.',
    glitch_prompt: 'Zeichne ein Symbol für das genaue Gegenteil deines heutigen Tages.',
    prompt_type: 'draw',
    options: null
  },
  {
    prompt: 'Zeichne blind ein Tier mit drei Beinen.',
    glitch_prompt: 'Zeichne blind ein Fantasiewesen, das fliegen kann, aber keine Flügel hat.',
    prompt_type: 'draw',
    options: null
  },
  {
    prompt: 'Skizziere kurz die Form einer Wolke, die heute über dir sein könnte.',
    glitch_prompt: 'Skizziere kurz einen Blitz oder Riss im Himmel.',
    prompt_type: 'draw',
    options: null
  },
  
  // FOTO & TEXTUR 📷
  {
    prompt: 'Finde etwas in deiner unmittelbaren Umgebung, das rot oder rostig ist.',
    glitch_prompt: 'Finde etwas in deiner Umgebung, das tiefblau, metallisch oder eiskalt wirkt.',
    prompt_type: 'photo',
    options: null
  },
  {
    prompt: 'Ein Blick aus deinem nächsten Fenster – zeig uns den Himmel über deiner Stadt.',
    glitch_prompt: 'Richte die Kamera direkt auf den Boden oder deine Füße.',
    prompt_type: 'photo',
    options: null
  },
  {
    prompt: 'Fotografiere eine Textur (Holz, Beton, Stoff, Kaffeeschaum), die du heute berührt hast.',
    glitch_prompt: 'Fotografiere eine Oberfläche, die extrem glatt oder spiegelnd ist.',
    prompt_type: 'photo',
    options: null
  },

  // SPEKTRUM & POLARITÄTEN ⚖️
  {
    prompt: 'Wo schlägt heute dein inneres Pendel aus?',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Kühler Verstand', 'Blinde Intuition']
  },
  {
    prompt: 'Dein innerer Energie-Kompass des heutigen Tages:',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Reine Beobachtung', 'Unbändiger Tatendrang']
  },
  {
    prompt: 'Wenn etwas schiefgeht – deine erste spontane Regung:',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Mit Humor nehmen', 'Alles sezieren']
  },

  // STILLE & ACHTSAMKEIT 🧘
  {
    prompt: 'Nimm dir 20 Sekunden vollkommene Stille. Lass das Rauschen der Welt kurz verblassen.',
    glitch_prompt: null,
    prompt_type: 'silence',
    options: null
  },

  // DILEMMA & ENTSCHEIDUNG 🎲
  {
    prompt: 'Dilemma: Eher ein Jahr lang jeden Tag derselbe Song oder nie wieder Musik hören?',
    glitch_prompt: null,
    prompt_type: 'choice',
    options: ['Jeden Tag derselbe Song', 'Nie wieder Musik']
  },
  {
    prompt: 'Entscheidung: Spontaner Nachtspaziergang durch die Stadt oder am Kamin einschlafen?',
    glitch_prompt: null,
    prompt_type: 'choice',
    options: ['Nachtspaziergang', 'Kaminfeuer']
  },

  // TIEFSINN & GEDANKEN ✍️
  {
    prompt: 'Was war der unscheinbarste Glücksmoment deines heutigen Tages?',
    glitch_prompt: 'Welche unscheinbare Absurdität oder kleine Panne ist dir heute passiert?',
    prompt_type: 'text',
    options: null
  },
  {
    prompt: 'Wofür bist du heute dankbar, das man nicht kaufen kann?',
    glitch_prompt: 'Auf welche Gewohnheit oder Pflicht hättest du heute liebend gern verzichtet?',
    prompt_type: 'text',
    options: null
  },
  {
    prompt: 'Was hat dich heute für einen Augenblick zum Schmunzeln gebracht?',
    glitch_prompt: 'Was hat dich heute für einen Moment irritiert oder stutzig gemacht?',
    prompt_type: 'text',
    options: null
  },

  // KOOPERATIVE RÄTSEL & FRAGMENTE 🧩
  {
    prompt: 'Die Welle ist in 4 Fragmente zerbrochen. Tauscht euch aus und findet das gemeinsame Lösungswort.',
    glitch_prompt: null,
    prompt_type: 'enigma',
    options: buildEnigmaOptions(
      'FEUER',
      [
        'Fütterst du mich, wachse ich und schenke dir wohlige Wärme.',
        'Gibst du mir Wasser, vergehe ich in bittergrauem Rauch.',
        'Ich habe keine Knochen, doch tanze ich wild im Wind.',
        'Ein winziger Funke genügt, um mich zu wecken. Wer bin ich?'
      ],
      'Geboren aus dem Funken, hungrig nach Holz.'
    )
  },
  {
    prompt: 'Die Welle ist in 4 Fragmente zerbrochen. Tauscht euch aus und findet das gemeinsame Lösungswort.',
    glitch_prompt: null,
    prompt_type: 'enigma',
    options: buildEnigmaOptions(
      'KOMPASS',
      [
        'Ich habe keine Augen und schaue stets starr nach Norden.',
        'Inmitten tosender Stürme bleibe ich unerschütterlich ausgerichtet.',
        'Mein Zeiger tanzt auf dem unsichtbaren Magnetfeld der Erde.',
        'Seefahrer vertrauen mir ihr Leben und ihren Kurs an. Wer bin ich?'
      ],
      'Ein 7-stelliges Navigationsinstrument.'
    )
  },
  {
    prompt: 'Die Welle ist in 4 Fragmente zerbrochen. Tauscht euch aus und findet das gemeinsame Lösungswort.',
    glitch_prompt: null,
    prompt_type: 'enigma',
    options: buildEnigmaOptions(
      'ECHO',
      [
        'Ich habe keine eigene Stimme, doch ich antworte jedem deiner Rufe.',
        'In tiefen Bergtälern und verlassenen Hallen bin ich zuhause.',
        'Ich wiederhole deine letzten Worte, doch verstehe keines davon.',
        'Mit jedem Schritt, den du weitergehst, verblasse ich. Wer bin ich?'
      ],
      'Ich spreche erst, wenn du geschwiegen hast.'
    )
  },

  // VIBE CHECK & BILD-DILEMMA 🎭
  {
    prompt: 'Bist du heute eher das übermüdete Faultier oder die hyperaktive Hummel?',
    glitch_prompt: null,
    prompt_type: 'vibe',
    options: buildVibeOptions([
      {
        id: 'opt_1',
        title: 'Zen-Faultier',
        prompt: 'cute sleepy cartoon sloth hugging a cup of herbal tea, cozy aesthetic illustration, minimalist',
        imageUrl: 'https://image.pollinations.ai/prompt/cute%20sleepy%20cartoon%20sloth%20hugging%20a%20cup%20of%20herbal%20tea%2C%20cozy%20aesthetic%20illustration?width=512&height=512&nologo=true&seed=42'
      },
      {
        id: 'opt_2',
        title: 'Hyperaktive Hummel',
        prompt: 'cute energetic bee zooming with speed trails holding a tiny espresso cup, vibrant cartoon illustration',
        imageUrl: 'https://image.pollinations.ai/prompt/cute%20energetic%20bee%20zooming%20with%20speed%20trails%20holding%20a%20tiny%20espresso%20cup%2C%20vibrant%20cartoon?width=512&height=512&nologo=true&seed=99'
      }
    ])
  },
  {
    prompt: 'Welcher Zustand beschreibt deinen heutigen Modus am besten?',
    glitch_prompt: null,
    prompt_type: 'vibe',
    options: buildVibeOptions([
      {
        id: 'opt_1',
        title: 'Überforderter Waschbär',
        prompt: 'funny stressed cute cartoon raccoon with wide eyes surrounded by floating sticky notes, comic style',
        imageUrl: 'https://image.pollinations.ai/prompt/funny%20stressed%20cute%20cartoon%20raccoon%20with%20wide%20eyes%2C%20comic%20style?width=512&height=512&nologo=true&seed=101'
      },
      {
        id: 'opt_2',
        title: 'Entspannter Capybara',
        prompt: 'chill cute cartoon capybara sitting in a warm onsen bath with a small yuzu fruit on head, serene aesthetic',
        imageUrl: 'https://image.pollinations.ai/prompt/chill%20cute%20cartoon%20capybara%20sitting%20in%20a%20warm%20onsen%20bath%20with%20yuzu%20on%20head%2C%20serene%20aesthetic?width=512&height=512&nologo=true&seed=202'
      }
    ])
  },
]

export async function POST(req: Request) {
  try {
    let force = false
    try {
      const body = await req.json()
      force = !!body?.force
    } catch {
      // kein JSON body
    }

    // 0. Prüfen, ob bereits eine aktive Welle existiert (verhindert Race Condition durch mehrere Clients)
    if (!force) {
      const { data: latestActive } = await supabase
        .from('waves')
        .select('*')
        .order('number', { ascending: false })
        .limit(1)

      if (latestActive && latestActive.length > 0) {
        const topWave = latestActive[0]
        if (topWave.status === 'active') {
          return NextResponse.json({ success: true, wave: topWave, deduplicated: true })
        }
      }
    }

    // 1. Vorherige Wellen und Mitglieder holen
    const [{ data: previousWaves }, { data: members }] = await Promise.all([
      supabase
        .from('waves')
        .select('number, prompt, responses(content)')
        .order('number', { ascending: false })
        .limit(5),
      supabase
        .from('members')
        .select('id, name')
    ])

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

    // Bestimme, ob diese Welle eine Asymmetrische Anomalie ("Der Flüsterer") ist (z. B. jede 3. oder 4. Welle)
    const memberList = members || []
    const isAnomaly = memberList.length >= 2 && (nextNumber % 3 === 0 || Math.random() < 0.25)

    const systemPrompt = `Du bist die mysteriöse, poetische und verbindende Intelligenz der Web-App "Welle".
Die Nutzer sind 4 gute Freunde, die zusammen lernen, aber im Alltag getrennt leben.
Deine Aufgabe ist es, die NÄCHSTE Welle zu kreieren.

WICHTIGSTE REGEL: ABWECHSLUNG! Wechsle aktiv zwischen Formaten ab:
- "spectrum": Philosophische Achse mit genau 2 prägnanten Polen in "options" (z.B. ["Kühler Verstand", "Blinde Intuition"])
- "photo": Ein Foto-Ausschnitt aus der realen Umgebung
- "draw": Minimalistische Finger-Zeichnung
- "choice": Unerwartetes A/B-Dilemma mit 2 Optionen
- "text": Tiefgründiger Gedanke oder Alltagsbeobachtung
- "silence": 20-30 Sekunden Achtsamkeit
- "enigma": Kooperatives 4-teiliges poetisches Rätsel. "options" MUSS sein: ["__solution__:WORT", "__hint__:Ein kurzer Tipp", "Fragment 1", "Fragment 2", "Fragment 3", "Fragment 4"]
- "vibe": Humorvolles Bild-Dilemma / Vibe-Check ("Bist du heute eher X oder Y?"). "options" MUSS ein Array von 2 oder 3 Objekten sein: [{"title": "Witziger Titel A", "image_prompt": "englischer Prompt für humorvolle Cartoon/Comic Illustration A"}, {"title": "Witziger Titel B", "image_prompt": "englischer Prompt für humorvolle Cartoon/Comic Illustration B"}]

${isAnomaly ? `ANOMALIE-MODUS AKTIV: Diese Welle ist eine geheime Asymmetrie ("Der Flüsterer"). 
Erstelle neben "prompt" ein zusätzliches Feld "glitch_prompt". Das ist eine geheime, leicht gespiegelte oder veränderte Aufforderung, die genau einem Freund heimlich untergeschoben wird (z.B. Normal: "Zeichne etwas, das dir Kraft gibt" vs. Glitch: "Zeichne etwas, das dir Kraft raubt" oder Normal: "Fotografiere etwas Altes" vs. Glitch: "Fotografiere etwas Brandneues").` : ''}

Beziehe dich subtil auf frühere Stimmungen der Gruppe. Halte Aufforderungen prägnant und poetisch.
Gib AUSSCHLIESSLICH valides JSON zurück:
{
  "prompt": "Deine Aufforderung hier",
  "prompt_type": "spectrum" | "photo" | "draw" | "choice" | "text" | "silence" | "enigma" | "vibe",
  "options": ["Option/Pol A", "Option/Pol B"] | null,
  ${isAnomaly ? '"glitch_prompt": "Die geheime abweichende Flüster-Aufforderung",' : ''}
}`

    let parsed: any = null

    // 2. Primär: Gemini 3.5-flash-lite aufrufen
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
        console.warn('Gemini generation failed, falling back to curated pool:', e)
      }
    }

    // 3. Intelligenter Pool-Fallback
    if (!parsed || !parsed.prompt) {
      const pastPrompts = (previousWaves || []).map(w => w.prompt)
      const available = CURATED_PROMPTS.filter(p => !pastPrompts.includes(p.prompt))
      parsed = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : CURATED_PROMPTS[nextNumber % CURATED_PROMPTS.length]
    }

    // 3.5 Vibe-Optionen transformieren falls nötig
    if (parsed && parsed.prompt_type === 'vibe' && Array.isArray(parsed.options)) {
      const isAlreadyBuilt = parsed.options.some((o: any) => typeof o === 'string' && o.startsWith('__vibe__:'))
      if (!isAlreadyBuilt) {
        const seedBase = Math.floor(Math.random() * 90000) + 10000
        const vibeItems = parsed.options.map((opt: any, idx: number) => {
          const title = typeof opt === 'string' ? opt : (opt.title || `Vibe ${idx + 1}`)
          const imgPrompt = (typeof opt === 'object' && opt.image_prompt)
            ? opt.image_prompt
            : `${title} funny cute cartoon character, vibrant comic illustration`
          const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imgPrompt)}?width=512&height=512&nologo=true&seed=${seedBase + idx}`
          return {
            id: `opt_${idx + 1}`,
            title,
            prompt: imgPrompt,
            imageUrl,
          }
        })
        parsed.options = buildVibeOptions(vibeItems)
      }
    }

    // 4. Glitch-Optionen zusammenstellen falls Anomalie
    let finalOptions: string[] | null = Array.isArray(parsed.options) ? parsed.options : null

    if (isAnomaly && memberList.length >= 2) {
      const glitchPrompt = parsed.glitch_prompt || 'Zeige oder beschreibe das genaue Gegenteil deines ersten Impulses.'
      // Wähle ein zufälliges Mitglied als Flüsterer
      const luckyMember = memberList[Math.floor(Math.random() * memberList.length)]
      finalOptions = attachGlitchToOptions(finalOptions, luckyMember.id, luckyMember.name, glitchPrompt)
    }

    // 5. Neue Welle in Supabase speichern
    const { data: newWave, error: insertError } = await supabase
      .from('waves')
      .insert({
        number: nextNumber,
        prompt: parsed.prompt,
        prompt_type: parsed.prompt_type || 'text',
        options: finalOptions,
        status: 'active',
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Web Push an alle Mitglieder senden
    try {
      await sendPushToMembers({
        payload: {
          title: `Welle ${nextNumber} ist da ∿`,
          body: parsed.prompt,
          url: '/',
          tag: `wave-${newWave.id}`,
        },
      })
    } catch (pushErr) {
      console.warn('[Push] Failed to dispatch push for new wave:', pushErr)
    }

    return NextResponse.json({ success: true, wave: newWave })
  } catch (error: any) {
    console.error('Error in generate-wave:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
