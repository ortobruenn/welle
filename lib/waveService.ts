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
// Tenor: abwechslungsreich – mal frech & locker, mal pfiffig & witzig, mal poetisch & atmosphärisch
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
    prompt: 'Kritzle in maximal 10 Sekunden das chaotischste Ding in deinem aktuellen Blickfeld.',
    glitch_prompt: 'Zeichne die reinste geometrische Ordnung, die dir einfällt.',
    prompt_type: 'draw',
    options: null
  },
  {
    prompt: 'Skizziere kurz deine aktuelle Laune als abstraktes Emoji.',
    glitch_prompt: 'Skizziere die Laune der Person, die dir heute am meisten auf die Nerven ging.',
    prompt_type: 'draw',
    options: null
  },
  
  // FOTO & TEXTUR 📷
  {
    prompt: 'Ein schneller Schnappschuss aus dem nächsten Fenster – zeig uns den Himmel über dir.',
    glitch_prompt: 'Richte die Kamera direkt auf den Boden oder deine Füße.',
    prompt_type: 'photo',
    options: null
  },
  {
    prompt: 'Fotografiere das unordentlichste oder absurdeste Detail in deiner Reichweite.',
    glitch_prompt: 'Fotografiere das ordentlichste, sterilste Ding, das du gerade sehen kannst.',
    prompt_type: 'photo',
    options: null
  },
  {
    prompt: 'Zeig uns deinen aktuellen Alltags-Retter: Kaffee, Snack oder Gegenstand des Tages.',
    glitch_prompt: 'Fotografiere etwas, das du heute am liebsten in den Müll werfen würdest.',
    prompt_type: 'photo',
    options: null
  },
  {
    prompt: 'Finde etwas in deiner unmittelbaren Umgebung, das knallig bunt oder rostig ist.',
    glitch_prompt: 'Finde etwas in deiner Umgebung, das tiefblau, metallisch oder eiskalt wirkt.',
    prompt_type: 'photo',
    options: null
  },

  // SPEKTRUM & POLARITÄTEN ⚖️
  {
    prompt: 'Wie steht dein interner Akku gerade?',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['120% Tatendrang & Hummeln im Hintern', '2% Energiesparmodus am Ladekabel']
  },
  {
    prompt: 'Dein heutiger Kopf-Zustand:',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Alles unter Kontrolle & strukturiert', '20 Tabs offen & Musik dudelt im Hintergrund']
  },
  {
    prompt: 'Wo schlägt heute dein inneres Pendel aus?',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Kühler Verstand', 'Bauchgefühl & Spontanität']
  },
  {
    prompt: 'Feierabend-Vibe für heute:',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Raus ins Leben & Leute treffen', 'Couch, Decke & Flugmodus']
  },

  // PULS & SYNCHRONITÄT ⏱️
  {
    prompt: 'Kurzer Reset: Schließe die Augen und halte den Kreis für genau 7 Sekunden gedrückt.',
    glitch_prompt: 'Halte den Kreis für genau 3 Sekunden gedrückt – lass viel früher los als gedacht.',
    prompt_type: 'pulse',
    options: null
  },

  // STILLE & ACHTSAMKEIT 🕯️
  {
    prompt: 'Nimm dir 30 Sekunden absolute Bildschirmpause. Berühre nichts, atme nur tief durch.',
    glitch_prompt: null,
    prompt_type: 'silence',
    options: null
  },

  // KOOPERATIVES RÄTSEL / ENIGMA 🧩 (Keine Fixierung auf Zahlen oder 'vier'!)
  {
    prompt: 'Eine alte Botschaft liegt in Fragmenten vor euch. Setzt eure Zeilen zusammen.',
    glitch_prompt: null,
    prompt_type: 'enigma',
    options: buildEnigmaOptions(
      'KOMPASS',
      [
        '1. Zeile: Wind und Weite weisen den Pfad,',
        '2. Zeile: Kein Stern verliert, wer den Norden bat.',
        '3. Zeile: Die Nadel zittert im Kupfergehäuse,',
        '4. Zeile: Sieben Buchstaben führen zur Heimkehr.'
      ],
      'Ein Instrument für Reisende'
    )
  },
  {
    prompt: 'Ein zerbrochenes Rätsel liegt auf dem Tisch. Findet gemeinsam das Lösungswort.',
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
  {
    prompt: 'Ein altes Schloss hütet ein Geheimnis. Kombiniert eure Puzzleteile.',
    glitch_prompt: null,
    prompt_type: 'enigma',
    options: buildEnigmaOptions(
      'SCHLUESSEL',
      [
        'Teil 1: Aus kaltem Eisen oder Messing schwer,',
        'Teil 2: Öffnet Welten und sperrt hinterher,',
        'Teil 3: Hat Zähne, doch kann niemals beißen,',
        'Teil 4: Liegt tief in der Tasche auf allen Reisen.'
      ],
      'Öffnet Türen'
    )
  },

  // DILEMMA & ENTSCHEIDUNG ⚡
  {
    prompt: 'Spontanes Gedanken-Dilemma:',
    glitch_prompt: null,
    prompt_type: 'choice',
    options: [
      '10 Jahre in die Vergangenheit mit heutigem Wissen',
      '10 Jahre in die Zukunft reisen und sehen, was kommt'
    ]
  },
  {
    prompt: 'Ehrliche Alltagsbeichte für heute:',
    glitch_prompt: 'Wähle das Gegenteil deiner wahren Antwort:',
    prompt_type: 'choice',
    options: [
      'Heute schon mindestens einmal hemmungslos prokrastiniert',
      'Verdächtig diszipliniert und produktiv durchgezogen'
    ]
  },
  {
    prompt: 'Wenn du heute eine Erinnerung an diesen Tag konservieren müsstest:',
    glitch_prompt: 'Wenn du heute eine peinliche Kleinigkeit sofort auslöschen könntest:',
    prompt_type: 'choice',
    options: [
      'Ein Geräusch oder ein Lied, das lief',
      'Ein Blick oder ein ungesagtes Wort'
    ]
  },

  // FREITEXT & ALLTAGSIMPULSE ✍️
  {
    prompt: 'Wenn dein heutiger Tag ein Buchtitel oder Netflix-Film wäre – wie würde er heißen?',
    glitch_prompt: 'Gib deinem Tag den langweiligsten Beamtendeutsch-Titel aller Zeiten.',
    prompt_type: 'text',
    options: null
  },
  {
    prompt: 'Was ist das Absurdeste, Lustigste oder Banalste, das dir heute passiert ist?',
    glitch_prompt: 'Erfinde eine winzige, scheinbar glaubhafte Lüge über deinen Tag.',
    prompt_type: 'text',
    options: null
  },
  {
    prompt: 'Welcher Gedanke ging dir heute durch den Kopf, ohne dass du ihn eingeladen hast?',
    glitch_prompt: 'Was ist der bescheuertste Ohrwurm oder Gedankenfetzen, den du heute hattest?',
    prompt_type: 'text',
    options: null
  },
  {
    prompt: 'Beschreibe mit genau 3 Worten deine aktuelle Verfassung.',
    glitch_prompt: 'Beschreibe mit genau 3 Worten das Gegenteil deiner aktuellen Verfassung.',
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
  {
    prompt: 'Wie tickt dein Kopf heute eher?',
    glitch_prompt: null,
    prompt_type: 'vibe',
    options: buildVibeOptions([
      {
        id: 'opt_1',
        title: 'Hyperaktives Eichhörnchen',
        prompt: 'funny hyperactive cartoon squirrel holding a giant cup of coffee with crazy energetic eyes, vibrant comic illustration',
        imageUrl: 'https://image.pollinations.ai/prompt/funny%20hyperactive%20cartoon%20squirrel%20holding%20a%20giant%20cup%20of%20coffee%2C%20comic%20illustration?width=512&height=512&nologo=true&seed=303'
      },
      {
        id: 'opt_2',
        title: 'Verschlafener Panda',
        prompt: 'cozy sleepy cute cartoon panda wrapped in a soft blanket eating a bamboo leaf, relaxed comic illustration',
        imageUrl: 'https://image.pollinations.ai/prompt/cozy%20sleepy%20cute%20cartoon%20panda%20wrapped%20in%20a%20blanket%2C%20comic%20illustration?width=512&height=512&nologo=true&seed=404'
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
    { type: 'spectrum', desc: 'Zwei gegensätzliche Pole in "options" (z.B. ["120% Tatendrang", "2% Akku auf der Couch"] oder ["Kühler Kopf", "Bauchgefühl"])' },
    { type: 'photo', desc: 'Schnappschuss aus dem Hier und Jetzt (z.B. das unordentlichste Eck, heutiger Kaffeestand, Wetter-Blick, Textur)' },
    { type: 'draw', desc: 'Schnelle Finger-Zeichnung auf Canvas (z.B. ein abstraktes Symbol, blind ein Tier, aktuelle Laune)' },
    { type: 'choice', desc: 'Knackiges, überraschendes A/B-Dilemma mit 2 prägnanten Optionen' },
    { type: 'pulse', desc: 'Kurzer Synchro-Moment: Kreis für 7 Sekunden rein nach Gefühl gedrückt halten' },
    { type: 'silence', desc: '30 Sekunden Bildschirmpause zum kurzen Durchatmen' },
    { type: 'enigma', desc: 'Kooperatives Worträtsel ("options": ["__solution__:WORT", "__hint__:Tipp", "Zeile 1", "Zeile 2", "Zeile 3", "Zeile 4"]) – niemals Zahlen wie "vier Bruchstücke" im Text erwähnen!' },
    { type: 'text', desc: 'Spontane Frage als Freitext (mal frech, mal neugierig, mal reflektiert)' },
    { type: 'vibe', desc: 'Humorvolles Bild-Dilemma / Vibe-Check ("Bist du heute eher X oder Y?") mit 2 lustigen Cartoon-Charakteren' }
  ]

  const allowedFormats = ALL_FORMATS.filter(f => !forbiddenTypes.includes(f.type))

  const memberList = members || []
  const isAnomaly = memberList.length >= 2 && (nextNumber % 3 === 0 || Math.random() < 0.25)

  // Dynamischer Stimmungs-Wechsel (Mood Variety)
  const MOODS = [
    {
      vibe: 'Locker, frisch & frech',
      instruction: 'Formuliere witzig, direkt, alltagsnah und mit feiner Selbstironie. Bring die Freunde zum Schmunzeln! Keine schwere Philosophie, sondern freche Alltags- und Gedankenimpulse.'
    },
    {
      vibe: 'Pfiffig, neugierig & leicht',
      instruction: 'Formuliere clever, charmant und neugierig. Eine originelle Frage oder ein Gedankenspiel, das sofort Spaß macht, überrascht und leicht von der Hand geht.'
    },
    {
      vibe: 'Warm, stimmungsvoll & poetisch',
      instruction: 'Formuliere poetisch, atmosphärisch und feinfühlig – aber OHNE kitschigen Schwulst, Pathos oder künstliche Schwere. Echte Wärme und Alltagslyrik statt Endzeitstimmung.'
    },
    {
      vibe: 'Spontan, absurd & verspielt',
      instruction: 'Formuliere verspielt, überraschend und mit einem kleinen Augenzwinkern. Ein knackiger, leicht schräger Impuls für zwischendurch.'
    }
  ]
  const chosenMood = MOODS[Math.floor(Math.random() * MOODS.length)]

  const systemPrompt = `Du bist die kreative, verbindende Intelligenz der Web-App "Welle".
Die Nutzer sind eine Gruppe enger Freunde, die gemeinsam ihren Alltag und ihre Gedanken teilen.
Deine Aufgabe ist es, die NÄCHSTE Welle zu kreieren.

DEIN TONALER FOKUS FÜR DIESE WELLE:
👉 ${chosenMood.vibe.toUpperCase()} 👈
${chosenMood.instruction}

STRENGE REGELN:
1. KEINE FIXIERUNG AUF DIE ZAHL VIER:
   - Es ist STRENGSTENS VERBOTEN, die Zahl 4 oder Formulierungen wie "ihr vier", "vier Freunde", "vier Stimmen", "vier Pfade", "vier Ecken" etc. zu verwenden!
   - Sprich die Gruppe natürlich mit "ihr" oder den Einzelnen mit "du" an. Völlig ohne Zahlen-Mystik.
2. ABWECHSLUNG IM TENOR (KEIN DAUER-PATHOS):
   - Vermeide übertrieben schwere, düstere oder pseudo-mystische Floskeln.
   - Sei frisch, pointiert, lebendig und charmant. Mal locker und frech, mal clever, mal poetisch.
   - Prompts müssen direkt zünden und leicht verständlich sein. Keine Schachtelsätze.
3. FORMAT-ABWECHSLUNG:
   Die letzten Wellen hatten folgende Formate: ${forbiddenTypes.length > 0 ? forbiddenTypes.join(', ') : 'keine'}.
   DIESE FORMATE SIND FÜR DIE NÄCHSTE WELLE STRENG VERBOTEN!

Wähle zwingend eines der folgenden ERLAUBTEN Formate:
${allowedFormats.map(f => `- "${f.type}": ${f.desc}`).join('\n')}

Format-Regeln:
${isAnomaly ? `- ANOMALIE AKTIV ("Der Flüsterer"): Erzeuge "glitch_prompt" (eine verdrehte, geheime oder witzige Gegen-Variante für genau einen Spieler!).` : '- Keine Anomalie: "glitch_prompt" ist null.'}

Kontext bisheriger Wellen:
${contextText}

Antworte STRIKT im JSON-Format:
{
  "prompt": "Die Hauptfrage / Anweisung an alle",
  "prompt_type": "${allowedFormats.map(f => f.type).join('" | "')}",
  "options": ["Option 1", "Option 2"] | null,
  "glitch_prompt": "Verdrehte Variante für den Flüsterer" | null
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
