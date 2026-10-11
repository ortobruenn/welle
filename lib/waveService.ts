import { createClient } from '@supabase/supabase-js'
import {
  attachGlitchToOptions,
  buildEnigmaOptions,
  buildVibeOptions,
  extractPreparedWave,
  attachPreparedWaveToOptions,
} from '@/lib/mystery'
import { sendPushToMembers } from '@/lib/pushServer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const geminiApiKey = process.env.GEMINI_API_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

// Bunter, vielseitiger Pool aus allen Erlebnis-Formaten inklusive Glitch-Varianten
export const CURATED_PROMPTS = [
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
    prompt: 'Welche Energie dominiert deinen Tag?',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Vorwärtsdrang & Tatendrang', 'Stiller Rückzug & Beobachtung']
  },
  {
    prompt: 'Wie fühlt sich die Welt heute um dich herum an?',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Dicht & Schnell', 'Weit & Zeitlos']
  },

  // PULS & SYNCHRONITÄT ⏱️
  {
    prompt: 'Schließe kurz die Augen. Halte den Kreis für genau 7 Sekunden gedrückt – rein nach Gefühl.',
    glitch_prompt: 'Halte den Kreis für genau 3 Sekunden gedrückt – lass früher los als gedacht.',
    prompt_type: 'pulse',
    options: null
  },

  // STILLE & ACHTSAMKEIT 🕯️
  {
    prompt: 'Nimm dir 30 Sekunden absolute Stille. Berühre nichts, atme nur tief ein und aus.',
    glitch_prompt: null,
    prompt_type: 'silence',
    options: null
  },

  // KOOPERATIVES RÄTSEL / ENIGMA 🧩
  {
    prompt: 'Ein altes Siegel liegt zerbrochen vor euch. Setzt eure Zeilen zusammen.',
    glitch_prompt: null,
    prompt_type: 'enigma',
    options: buildEnigmaOptions(
      'KOMPASS',
      [
        '1. Zeile: Aus vier Winden formt sich der Pfad,',
        '2. Zeile: Kein Stern verliert, wer den Norden bat.',
        '3. Zeile: Die Nadel zittert im Kupfergehäuse,',
        '4. Zeile: Sieben Buchstaben weisen die Heimkehr.'
      ],
      'Ein Instrument für Reisende'
    )
  },
  {
    prompt: 'Die alte Tafel wurde in vier Bruchstücke geteilt. Findet das Lösungswort.',
    glitch_prompt: null,
    prompt_type: 'enigma',
    options: buildEnigmaOptions(
      'SPIEGEL',
      [
        'Teil 1: Glas und Silber im Dämmerlicht,',
        'Teil 2: Zeigt dein Antlitz, spricht doch nicht.',
        'Teil 3: Verdoppelt den Raum mit stummer Gebärde,',
        'Teil 4: Bricht entzwei, wenn es fällt zur Erde.'
      ],
      'Täglicher Blick'
    )
  },

  // DILEMMA & TIEFSINNIGE ENTSCHEIDUNG ⚡
  {
    prompt: 'Wenn du heute eine Erinnerung an diesen Tag für immer konservieren müsstest:',
    glitch_prompt: 'Wenn du heute eine peinliche oder banale Kleinigkeit sofort auslöschen könntest:',
    prompt_type: 'choice',
    options: [
      'Ein Geräusch oder ein Lied, das lief',
      'Ein Blick oder ein ungesagtes Wort'
    ]
  },
  {
    prompt: 'Was wiegt heute schwerer in deinen Gedanken?',
    glitch_prompt: null,
    prompt_type: 'choice',
    options: [
      'Was noch vor dir liegt',
      'Was du bereits hinter dir gelassen hast'
    ]
  },

  // FREITEXT & TIEFGANG ✍️
  {
    prompt: 'Welcher Gedanke ist dir heute wiederholt durch den Kopf gegangen, ohne dass du ihn eingeladen hast?',
    glitch_prompt: 'Was ist der absurdeste oder belangloseste Gedanke, den du heute hattest?',
    prompt_type: 'text',
    options: null
  },
  {
    prompt: 'Was hast du heute getan, das niemand gesehen hat?',
    glitch_prompt: 'Was hast du heute getan, das du lieber ungeschehen machen würdest?',
    prompt_type: 'text',
    options: null
  },
  {
    prompt: 'Beschreibe mit genau 3 Worten den Raum, in dem du dich gerade befindest.',
    glitch_prompt: 'Beschreibe mit genau 3 Worten das Gegenteil des Raumes, in dem du dich befindest.',
    prompt_type: 'text',
    options: null
  },

  // VIBE-CHECK / BILD-DILEMMA 🎭
  {
    prompt: 'Welcher Charakter spiegelt deinen Zustand gerade besser wider?',
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

export async function generateWaveContent(
  previousWaves: any[],
  members: any[],
  nextNumber: number
): Promise<{ prompt: string; prompt_type: string; options: string[] | null }> {
  let contextText = ''
  if (previousWaves && previousWaves.length > 0) {
    contextText = 'Bisherige Wellen der Gruppe:\n' + previousWaves.map(w => {
      const respList = (w.responses || []).map((r: any) => `"${r.content}"`).join(', ')
      return `Welle ${w.number} [Format: ${w.prompt_type || 'text'}]: "${w.prompt}" | Antworten: [${respList}]`
    }).join('\n')
  }

  // Letzte 2-3 Formate ermitteln – DIESE DÜRFEN SICH KEINESFALLS WIEDERHOLEN!
  const recentTypes = (previousWaves || [])
    .map(w => w.prompt_type)
    .filter(Boolean) as string[]
  const forbiddenTypes = Array.from(new Set(recentTypes.slice(0, 2)))

  const ALL_FORMATS = [
    { type: 'spectrum', desc: 'Philosophische Achse mit 2 prägnanten Polen in "options" (z.B. ["Kühler Verstand", "Blinde Intuition"])' },
    { type: 'photo', desc: 'Foto-Ausschnitt aus der realen Umgebung (z.B. Blick aus dem Fenster, Textur, Farbe)' },
    { type: 'draw', desc: 'Minimalistische Finger-Zeichnung auf Canvas' },
    { type: 'choice', desc: 'Unerwartetes A/B-Dilemma mit 2 Text-Optionen' },
    { type: 'pulse', desc: '7 Sekunden Atemzug / Kreis gedrückt halten rein nach Gefühl' },
    { type: 'silence', desc: '30 Sekunden Stille & Achtsamkeit ohne Tastendruck' },
    { type: 'enigma', desc: 'Kooperatives 4-teiliges poetisches Rätsel ("options": ["__solution__:WORT", "__hint__:Tipp", "Teil 1", "Teil 2", "Teil 3", "Teil 4"])' },
    { type: 'text', desc: 'Tiefgründiger Gedanke oder Alltagsbeobachtung in Freitext' },
    { type: 'vibe', desc: 'Humorvolles Bild-Dilemma / Vibe-Check ("Bist du heute eher X oder Y?") mit 2 Cartoon-Charakteren' }
  ]

  const allowedFormats = ALL_FORMATS.filter(f => !forbiddenTypes.includes(f.type))

  const memberList = members || []
  const isAnomaly = memberList.length >= 2 && (nextNumber % 3 === 0 || Math.random() < 0.25)

  const systemPrompt = `Du bist die mysteriöse, poetische und verbindende Intelligenz der Web-App "Welle".
Die Nutzer sind 4 gute Freunde, die zusammen lernen, aber im Alltag getrennt leben.
Deine Aufgabe ist es, die NÄCHSTE Welle zu kreieren.

OBERSTE REGEL: FORMAT-ABWECHSLUNG!
Die letzten Wellen hatten folgende Formate: ${forbiddenTypes.length > 0 ? forbiddenTypes.join(', ') : 'keine'}.
DIESE FORMATE SIND FÜR DIE NÄCHSTE WELLE STRENG VERBOTEN!

Wähle zwingend eines der folgenden ERLAUBTEN Formate:
${allowedFormats.map(f => `- "${f.type}": ${f.desc}`).join('\n')}

Format-Regeln:
${isAnomaly ? `- ANOMALIE AKTIV ("Der Flüsterer"): Erzeuge "glitch_prompt" (eine verdrehte, geheime Variante für genau einen Spieler!).` : '- Keine Anomalie: "glitch_prompt" ist null.'}

Kontext:
${contextText}

Antworte STRIKT im JSON-Format:
{
  "prompt": "Die Hauptfrage / Anweisung an alle",
  "prompt_type": "${allowedFormats.map(f => f.type).join('" | "')}",
  "options": ["Option 1", "Option 2"] | null,
  "glitch_prompt": "Verdrehte geheime Variante für den Flüsterer" | null
}`

  let parsed: any = null

  if (geminiApiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.9,
          }
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

  // Intelligenter Pool-Fallback MIT STRIKTER ABWECHSLUNGS-GARANTIE:
  // Falls Gemini fehlt, fehlschlägt ODER trotz Verbot wieder ein vor kurzem genutztes Format gewählt hat:
  if (!parsed || !parsed.prompt || forbiddenTypes.includes(parsed.prompt_type)) {
    if (parsed?.prompt_type && forbiddenTypes.includes(parsed.prompt_type)) {
      console.warn(`[Wave] Gemini ignorierte Diversität und wählte verbotenes Format "${parsed.prompt_type}". Ersetze durch erlaubtes Pool-Format!`)
    }
    const pastPrompts = (previousWaves || []).map(w => w.prompt)
    // Nur Formate erlauben, die nicht in den letzten 2 Wellen waren
    const availableAllowed = CURATED_PROMPTS.filter(p => !forbiddenTypes.includes(p.prompt_type))
    const freshAllowed = availableAllowed.filter(p => !pastPrompts.includes(p.prompt))
    const pool = freshAllowed.length > 0 ? freshAllowed : (availableAllowed.length > 0 ? availableAllowed : CURATED_PROMPTS)
    parsed = pool[Math.floor(Math.random() * pool.length)]
  }

  // Vibe-Optionen transformieren falls nötig
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

  let finalOptions: string[] | null = Array.isArray(parsed.options) ? parsed.options : null

  if (isAnomaly && memberList.length >= 2) {
    const glitchPrompt = parsed.glitch_prompt || 'Zeige oder beschreibe das genaue Gegenteil deines ersten Impulses.'
    const luckyMember = memberList[Math.floor(Math.random() * memberList.length)]
    finalOptions = attachGlitchToOptions(finalOptions, luckyMember.id, luckyMember.name, glitchPrompt)
  }

  return {
    prompt: parsed.prompt,
    prompt_type: parsed.prompt_type || 'text',
    options: finalOptions,
  }
}

export async function prepareWaveContent(waveId?: string): Promise<{ success: boolean; prepared?: boolean; alreadyPrepared?: boolean; wave?: any }> {
  let waveToPrepare: any = null
  if (waveId) {
    const { data } = await supabase.from('waves').select('*').eq('id', waveId).single()
    waveToPrepare = data
  } else {
    const { data } = await supabase.from('waves').select('*').order('number', { ascending: false }).limit(1)
    waveToPrepare = data?.[0]
  }

  if (!waveToPrepare) return { success: false }

  const existing = extractPreparedWave(waveToPrepare.options)
  if (existing) {
    return { success: true, alreadyPrepared: true, wave: waveToPrepare }
  }

  const [{ data: previousWaves }, { data: members }] = await Promise.all([
    supabase.from('waves').select('number, prompt, prompt_type, responses(content)').order('number', { ascending: false }).limit(6),
    supabase.from('members').select('id, name')
  ])

  const nextNumber = waveToPrepare.number + 1
  const preparedContent = await generateWaveContent(previousWaves || [], members || [], nextNumber)

  const updatedOptions = attachPreparedWaveToOptions(waveToPrepare.options, preparedContent)
  await supabase.from('waves').update({ options: updatedOptions }).eq('id', waveToPrepare.id)

  return { success: true, prepared: true, wave: waveToPrepare }
}

export async function activateWaveInternal(force = false): Promise<{ success: boolean; wave?: any; deduplicated?: boolean; inProgress?: boolean; message?: string }> {
  let lockedWaveId: string | null = null

  try {
    let topWave: any = null
    if (!force) {
      const { data: latestActive } = await supabase
        .from('waves')
        .select('*')
        .order('number', { ascending: false })
        .limit(1)

      if (latestActive && latestActive.length > 0) {
        topWave = latestActive[0]
        if (topWave.status === 'active') {
          return { success: true, wave: topWave, deduplicated: true }
        }

        // Wenn die Welle im Cooldown ist: Prüfen, ob die Zeit abgelaufen ist
        if (topWave.status === 'cooldown' && topWave.next_wave_at) {
          const isTimeUp = new Date(topWave.next_wave_at).getTime() <= Date.now()
          if (!isTimeUp) {
            return { success: false, message: 'Cooldown noch aktiv', wave: topWave }
          }

          // Atomare Sperre: next_wave_at um 5 Minuten in die Zukunft verschieben
          const lockTime = new Date(Date.now() + 5 * 60 * 1000).toISOString()
          const { data: claimed } = await supabase
            .from('waves')
            .update({ next_wave_at: lockTime })
            .eq('id', topWave.id)
            .eq('status', 'cooldown')
            .lte('next_wave_at', new Date().toISOString())
            .select()

          if (!claimed || claimed.length === 0) {
            return { success: true, wave: topWave, inProgress: true }
          }

          lockedWaveId = topWave.id
        }
      }
    }

    // Vorherige Wellen und Mitglieder holen
    const [{ data: previousWaves }, { data: members }] = await Promise.all([
      supabase.from('waves').select('number, prompt, prompt_type, responses(content)').order('number', { ascending: false }).limit(6),
      supabase.from('members').select('id, name')
    ])

    const nextNumber = previousWaves && previousWaves.length > 0
      ? Math.max(...previousWaves.map(w => w.number)) + 1
      : 1

    // Prüfen, ob bereits vorab vorbereitete Inhalte vorliegen (Zero Latency!)
    const cachedPrepared = topWave ? extractPreparedWave(topWave.options) : null
    let content: { prompt: string; prompt_type: string; options: string[] | null }

    if (cachedPrepared && !force) {
      content = cachedPrepared
    } else {
      content = await generateWaveContent(previousWaves || [], members || [], nextNumber)
    }

    // Neue Welle speichern UND Web Push zeitgleich absenden!
    const [insertResult] = await Promise.all([
      supabase
        .from('waves')
        .insert({
          number: nextNumber,
          prompt: content.prompt,
          prompt_type: content.prompt_type || 'text',
          options: content.options,
          status: 'active',
        })
        .select()
        .single(),
      sendPushToMembers({
        payload: {
          title: `Welle ${nextNumber} ist da ∿`,
          body: content.prompt,
          url: '/',
          tag: `wave-${nextNumber}`,
        },
      }).catch(err => {
        console.warn('[Push] Dispatch error:', err)
        return null
      }),
    ])

    const { data: newWave, error: insertError } = insertResult
    if (insertError) throw insertError

    return { success: true, wave: newWave }
  } catch (error: any) {
    console.error('Error activating wave:', error)
    if (lockedWaveId) {
      try {
        await supabase
          .from('waves')
          .update({ next_wave_at: new Date().toISOString() })
          .eq('id', lockedWaveId)
      } catch {}
    }
    throw error
  }
}
