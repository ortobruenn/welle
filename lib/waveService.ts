import { createClient } from '@supabase/supabase-js'
import {
  attachUndercoverToOptions,
  extractPreparedWave,
  attachPreparedWaveToOptions,
  extractEcho,
  parseSpectrumResponse,
  parseChallengeResponse,
  attachLogicConfigToOptions,
  attachScrambleConfigToOptions,
  buildDeterministicWordScramble,
  buildDeterministicNumberScramble,
  extractScrambleConfig,
} from '@/lib/mystery'
import { sendPushToMembers } from '@/lib/pushServer'
import type { CoreWaveType, LogicWaveConfig } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const geminiApiKey = process.env.GEMINI_API_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

export interface CuratedPromptItem {
  prompt: string
  glitch_prompt: string | null
  prompt_type: CoreWaveType
  options: string[] | null
}

// ---------------------------------------------------------------------------
// KURATIERTER PREMIUM-POOL: 4 KERN-FORMATE MIT MAXIMALER SOZIALER REIBUNG
// ---------------------------------------------------------------------------
export const CURATED_PROMPTS: CuratedPromptItem[] = [
  // 1. BLIND-BEICHTE (text) – Anonym abgeben, danach raten wer was gesagt hat
  {
    prompt: 'Welche völlig harmlose Alltagssache bringt dich innerlich sofort auf 180?',
    glitch_prompt: null,
    prompt_type: 'text',
    options: null,
  },
  {
    prompt: 'Was ist deine heimliche „Unpopular Opinion“, für die du in dieser Runde wahrscheinlich Gegenwind bekommst?',
    glitch_prompt: null,
    prompt_type: 'text',
    options: null,
  },
  {
    prompt: 'Wenn dein heutiger Tag ein Filmtitel wäre – wie würde er heißen?',
    glitch_prompt: null,
    prompt_type: 'text',
    options: null,
  },
  {
    prompt: 'Welchen Satz hast du heute gedacht, aber wohlweislich nicht laut ausgesprochen?',
    glitch_prompt: null,
    prompt_type: 'text',
    options: null,
  },
  {
    prompt: 'Was ist die seltsamste Angewohnheit, die du hast, wenn absolut niemand zuschaut?',
    glitch_prompt: null,
    prompt_type: 'text',
    options: null,
  },
  {
    prompt: 'Worüber hast du dir diese Woche viel zu viele Gedanken gemacht?',
    glitch_prompt: null,
    prompt_type: 'text',
    options: null,
  },
  {
    prompt: 'Wenn wir morgen zusammen ohne Plan für 48 Stunden wegfahren würden: Wo landen wir und wer verliert zuerst die Nerven?',
    glitch_prompt: null,
    prompt_type: 'text',
    options: null,
  },
  {
    prompt: 'Welche kleine Lüge erzählst du dir selbst am häufigsten?',
    glitch_prompt: null,
    prompt_type: 'text',
    options: null,
  },

  // 2. SABOTAGE / MAULWURF (undercover) – Einer kriegt heimlich eine verdrehte Gegenmission
  {
    prompt: 'Was ist für dich der ultimative Beweis, dass jemand sein Leben im Griff hat?',
    glitch_prompt: 'Schmuggle unauffällig etwas völlig Absurdes oder Chaotisches ein und verkaufe es todernst als Zeichen höchster Reife!',
    prompt_type: 'undercover',
    options: null,
  },
  {
    prompt: 'Beschreibe in einem Satz deinen perfekten, entspannten Sonntagmorgen.',
    glitch_prompt: 'Beschreibe einen subtil stressigen Albtraum-Morgen, aber verpacke ihn klanglich so idyllisch, dass niemand Verdacht schöpft!',
    prompt_type: 'undercover',
    options: null,
  },
  {
    prompt: 'Was schätzt du an unserer Freundesrunde am allermeisten?',
    glitch_prompt: 'Gib ein Kompliment ab, das bei genauerem Hinsehen eigentlich ein frecher, liebevoller Seitenhieb ist – ohne aufzufliegen!',
    prompt_type: 'undercover',
    options: null,
  },
  {
    prompt: 'Welches Essen geht einfach immer, egal zu welcher Uhrzeit?',
    glitch_prompt: 'Nenne eine kulinarisch höchst fragwürdige Kombination, aber verteidige sie so leidenschaftlich, dass sie fast plausibel klingt!',
    prompt_type: 'undercover',
    options: null,
  },
  {
    prompt: 'Was würdest du sofort tun, wenn du ab morgen einen Monat lang komplett offline wärst?',
    glitch_prompt: 'Antworte wie jemand, der heimlich nach 12 Minuten ohne WLAN panisch wird, es aber als spirituelle Erleuchtung tarnt!',
    prompt_type: 'undercover',
    options: null,
  },
  {
    prompt: 'Was war dein bisher bester Kauf in diesem Jahr?',
    glitch_prompt: 'Erfinde einen völlig nutzlosen Impulskauf oder lobe einen Alltagsgegenstand so übertrieben, als hätte er dein Leben gerettet!',
    prompt_type: 'undercover',
    options: null,
  },

  // 3. FREQUENZ-SPEKTRUM + GRUPPEN-RADAR (spectrum) – Wo stehst du & wo schätzt du die Gruppe?
  {
    prompt: 'Wie steht dein interner Energie-Akku genau in dieser Sekunde?',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['2% Notstrom & Decke übern Kopf', '120% Espresso-Überdosis & Tatendrang'],
  },
  {
    prompt: 'Wie sieht es heute in deinem Kopf aus?',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Zen-Kloster & glasklare Struktur', '37 Browser-Tabs offen & irgendwo läuft Musik'],
  },
  {
    prompt: 'Dein soziales Bedürfnis für den Rest des heutigen Tages:',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Einsiedlerkrebs – bitte nicht ansprechen', 'Bühne frei – wo sind die Menschen?!'],
  },
  {
    prompt: 'Wie triffst du aktuell deine Entscheidungen?',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Eiskalte Excel-Logik', 'Reines Bauchgefühl & Chaos-Vertrauen'],
  },
  {
    prompt: 'Dein aktueller Geduldsfaden heute:',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Reißt beim kleinsten Atmen', 'Unerschütterlicher Buddha'],
  },
  {
    prompt: 'Wie spontan bist du heute drauf?',
    glitch_prompt: null,
    prompt_type: 'spectrum',
    options: ['Pyjama ist bereits mental gebucht', 'Pack die Tasche, ich bin in 5 Minuten da'],
  },

  // 4. 35s-BLINDFUNK (draw) – 35 Sekunden Tinten-Countdown auf dem Canvas
  {
    prompt: 'Zeichne in 35 Sekunden dein aktuelles Energielevel als Wetterphänomen.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Skizziere ein Tier, das genau deine heutige Laune verkörpert.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Zeichne das Erste, was du siehst, wenn du jetzt den Kopf nach links drehst.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Zeichne unser Gruppen-Maskottchen, wenn wir eine zwielichtige Bande wären.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Skizziere in 35 Sekunden, wie dein Gehirn heute Morgen beim Aufwachen aussah.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Zeichne einen Gegenstand, der dich heute schon gerettet (oder genervt) hat.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Zeichne deine aktuelle kulinarische Sehnsucht auf einem Teller.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Skizziere das Fortbewegungsmittel, mit dem du heute am liebsten unterwegs wärst.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Zeichne deinen inneren Schweinehund bei seiner Lieblingsbeschäftigung.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Skizziere den Ort, an den du dich jetzt sofort hinbeamen würdest.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Zeichne eine Erfindung, die deinen heutigen Alltag sofort einfacher machen würde.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Skizziere dich selbst als Superheld mit einer völlig nutzlosen Alltagskraft.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Zeichne das Filmplakat zu deiner bisherigen Woche.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },
  {
    prompt: 'Skizziere in 35 Sekunden dein perfektes Wochenend-Versteck.',
    glitch_prompt: null,
    prompt_type: 'draw',
    options: null,
  },

  // 5. LIVE-SCHNAPPSCHUSS (photo) – Direkter Blick durch die Rückkamera
  {
    prompt: 'Zeig uns genau jetzt den unordentlichsten oder ehrlichsten Winkel in deiner direkten Sichtweite.',
    glitch_prompt: null,
    prompt_type: 'photo',
    options: null,
  },
  {
    prompt: 'Fotografiere deinen aktuellen Alltags-Retter: Getränk, Snack oder Gegenstand des Tages.',
    glitch_prompt: null,
    prompt_type: 'photo',
    options: null,
  },
  {
    prompt: 'Ein schneller Schnappschuss aus dem nächsten Fenster – wie sieht die Welt bei dir gerade aus?',
    glitch_prompt: null,
    prompt_type: 'photo',
    options: null,
  },
  {
    prompt: 'Finde in deiner unmittelbaren Umgebung eine Oberfläche oder ein Detail mit einer spannenden Textur.',
    glitch_prompt: null,
    prompt_type: 'photo',
    options: null,
  },

  // 6. 35S-GEDÄCHTNIS-TRESOR (memory)
  {
    prompt: 'Kurzzeitgedächtnis-Check: Präge dir die 6 leuchtenden Stationen ein und tippe sie in 35 Sekunden blind von 1 bis 6 ab!',
    glitch_prompt: null,
    prompt_type: 'memory',
    options: null,
  },
  {
    prompt: '35-Sekunden-Tresor: Wer behält den kühlen Kopf und wer kassiert heute das offizielle Trostpflaster?',
    glitch_prompt: null,
    prompt_type: 'memory',
    options: null,
  },

  // 7. DIE LOGIK-FALLE (logic)
  {
    prompt: 'Ein Schläger und ein Ball kosten zusammen 1,10 €. Der Schläger kostet genau 1,00 € mehr als der Ball. Was kostet der Ball?',
    glitch_prompt: null,
    prompt_type: 'logic',
    options: null,
  },
  {
    prompt: 'Du überholst in einem Rennen die Person auf dem 2. Platz. Auf welchem Platz befindest du dich direkt danach?',
    glitch_prompt: null,
    prompt_type: 'logic',
    options: null,
  },

  // 8. 35S-KNIFFEL-SPRINT (scramble)
  {
    prompt: '35s-Buchstabensalat: Bringe die durcheinandergewürfelten Buchstaben in die richtige Reihenfolge!',
    glitch_prompt: null,
    prompt_type: 'scramble',
    options: null,
  },
]

const CURATED_LOGIC_RIDDLES: Array<{
  prompt: string
  config: LogicWaveConfig
}> = [
  {
    prompt:
      'Ein Schläger und ein Ball kosten zusammen 1,10 €. Der Schläger kostet genau 1,00 € mehr als der Ball. Was kostet der Ball?',
    config: {
      choices: ['5 Cent', '10 Cent', '1 Cent', '15 Cent'],
      correctIndex: 0,
      explanation:
        'Kostet der Ball 5 Cent und der Schläger 1,00 € mehr (also 1,05 €), ergibt das zusammen exakt 1,10 €. Bei 10 Cent läge die Summe bei 1,20 €!',
    },
  },
  {
    prompt:
      'Wenn 5 Maschinen genau 5 Minuten brauchen, um 5 Bauteile herzustellen – wie lange brauchen dann 100 Maschinen für 100 Bauteile?',
    config: {
      choices: ['100 Minuten', '5 Minuten', '20 Minuten', '1 Minute'],
      correctIndex: 1,
      explanation:
        'Jede einzelne Maschine braucht genau 5 Minuten für 1 Bauteil. 100 Maschinen arbeiten parallel und sind deshalb ebenfalls nach 5 Minuten fertig.',
    },
  },
  {
    prompt:
      'Auf einem See verdoppelt sich ein Seerosenteppich jeden Tag. Nach 48 Tagen ist der gesamte See bedeckt. Nach wie vielen Tagen war er genau zur Hälfte bedeckt?',
    config: {
      choices: ['24 Tage', '47 Tage', '36 Tage', '46 Tage'],
      correctIndex: 1,
      explanation:
        'Da sich die Fläche jeden Tag verdoppelt, muss der See genau einen Tag vor der vollständigen Bedeckung (Tag 48) halb voll gewesen sein: an Tag 47.',
    },
  },
  {
    prompt:
      'Drei Freunde (Alex, Ben, Clara): Alex sagt „Ben lügt“. Ben sagt „Clara lügt“. Clara sagt „Alex und Ben lügen beide“. Wer sagt die Wahrheit?',
    config: {
      choices: ['Nur Alex', 'Nur Ben', 'Nur Clara', 'Alex und Clara'],
      correctIndex: 1,
      explanation:
        'Würde Ben lügen, müsste Clara die Wahrheit sagen – dann dürfte Alex aber nicht wahr sprechen. Also sagt einzig Ben die Wahrheit, während Alex und Clara lügen.',
    },
  },
  {
    prompt:
      'Du nimmst an einem Stadtlauf teil und überholst kurz vor dem Ziel die Person auf Platz 2. Auf welchem Platz bist du jetzt?',
    config: {
      choices: ['Platz 1', 'Platz 2', 'Platz 3', 'Unentschieden'],
      correctIndex: 1,
      explanation:
        'Wenn du die Person auf dem 2. Platz überholst, nimmst du deren 2. Platz ein – die Person auf Platz 1 läuft noch vor dir.',
    },
  },
]

const CURATED_WORD_SCRAMBLES: Array<{ word: string; hint: string }> = [
  { word: 'KAFFEE', hint: 'Heißer Wachmacher am Morgen' },
  { word: 'SONNTAG', hint: 'Der entspannteste Tag der Woche' },
  { word: 'URLAUB', hint: 'Wenn der Wecker endlich Pause hat' },
  { word: 'FEIERABEND', hint: 'Der schönste Moment nach der Arbeit' },
  { word: 'KINOABEND', hint: 'Popcorn und große Leinwand' },
  { word: 'KOPFKINO', hint: 'Wenn die Gedanken einen eigenen Film drehen' },
  { word: 'NACHTEULE', hint: 'Mensch, der erst spät abends richtig wach wird' },
  { word: 'SOFAECKE', hint: 'Gemütlicher Rückzugsort im Wohnzimmer' },
  { word: 'FRUEHSTUECK', hint: 'Die erste Mahlzeit des Tages' },
  { word: 'BAUCHGEFUEHL', hint: 'Innere Stimme ohne langes Nachdenken' },
]

const CORE_FORMATS: Array<{ type: CoreWaveType; desc: string }> = [
  {
    type: 'text',
    desc: 'Blind-Beichte: Eine freche, ehrliche oder originelle Impulsfrage. Die Antworten werden anonym abgegeben und die Freunde müssen raten, wer was geschrieben hat.',
  },
  {
    type: 'memory',
    desc: '35s-Gedächtnis-Tresor: Visuelles Kurzzeitgedächtnis-Kniffel auf einem 4x4-Grid (Zahlen 1 bis 6 merken und in 35s blind antippen).',
  },
  {
    type: 'undercover',
    desc: 'Sabotage / Maulwurf: Eine Hauptfrage für die Gruppe + eine geheime, verdrehte Tarn-Mission (glitch_prompt) für einen Undercover-Agenten, der unentdeckt bleiben muss.',
  },
  {
    type: 'logic',
    desc: 'Die Logik-Falle: Eine scharfe 35-Sekunden-Deduktions- oder Fangfrage mit 4 Antwortoptionen, genau 1 richtigen Lösung und 1 Satz Erklärung.',
  },
  {
    type: 'spectrum',
    desc: 'Frequenz-Spektrum: Eine Frage zum aktuellen Zustand mit 2 gegensätzlichen, pointierten Polen in options: ["Pol Links (0%)", "Pol Rechts (100%)"].',
  },
  {
    type: 'scramble',
    desc: '35s-Kniffel-Sprint: Abwechselnd Buchstabensalat (Alltagswort in 35s aus Buchstabenkacheln bilden) oder Zahlen-Kombination (3 aus 9 Zahlen in 35s zur Zielsumme kombinieren).',
  },
  {
    type: 'draw',
    desc: '35s-Blindfunk: Eine witzige, konkrete und jedes Mal völlig neue 35-Sekunden-Zeichenaufgabe auf dem Mini-Canvas.',
  },
  {
    type: 'photo',
    desc: 'Live-Schnappschuss: Ein spontaner Kamera-Impuls für die Rückkamera aus der unmittelbaren Umgebung.',
  },
]

function computeAllowedFormats(previousWaves: any[]) {
  const cycleSize = CORE_FORMATS.length
  const totalPlayed = previousWaves ? previousWaves.length : 0
  const wavesInCurrentCycle = totalPlayed % cycleSize
  const recentTypes = (previousWaves || []).slice(0, wavesInCurrentCycle).map(w => w.prompt_type)
  const lastType = previousWaves?.[0]?.prompt_type

  let allowed = CORE_FORMATS.filter(f => !recentTypes.includes(f.type) && f.type !== lastType)
  if (allowed.length === 0) {
    allowed = CORE_FORMATS.filter(f => f.type !== lastType)
  }
  if (allowed.length === 0) {
    allowed = CORE_FORMATS
  }
  return allowed
}

function buildGroupMemoryContext(
  previousWaves: any[],
  memberList: { id: string; name: string }[]
): string {
  if (!previousWaves || previousWaves.length === 0) {
    return '(Noch keine bisherigen Wellen – das ist der Start der Chronik.)'
  }

  const memberMap = new Map(memberList.map(m => [m.id, m.name]))

  return previousWaves
    .slice(0, 10)
    .map(w => {
      const lines: string[] = [`• Welle #${w.number} [${w.prompt_type}]: "${w.prompt}"`]

      const responses = Array.isArray(w.responses) ? w.responses : []
      if (w.prompt_type === 'text' || w.prompt_type === 'undercover') {
        const textAnswers = responses
          .filter(
            (r: any) =>
              typeof r?.content === 'string' &&
              r.content.trim().length > 0 &&
              !r.content.startsWith('data:image')
          )
          .map((r: any) => {
            const name =
              r?.members?.name || (r?.member_id ? memberMap.get(r.member_id) : null) || 'Freund'
            return `${name}: "${r.content.trim()}"`
          })
        if (textAnswers.length > 0) {
          lines.push(`  Antworten der Gruppe: ${textAnswers.join(' | ')}`)
        }
      } else if (w.prompt_type === 'spectrum') {
        const cleanPoles = Array.isArray(w.options)
          ? w.options.filter((o: string) => typeof o === 'string' && !o.startsWith('__'))
          : []
        const poleInfo =
          cleanPoles.length >= 2 ? ` (0%: "${cleanPoles[0]}" ↔ 100%: "${cleanPoles[1]}")` : ''
        const specAnswers = responses
          .map((r: any) => {
            if (typeof r?.content !== 'string') return null
            const parsed = parseSpectrumResponse(r.content)
            const name =
              r?.members?.name || (r?.member_id ? memberMap.get(r.member_id) : null) || 'Freund'
            return `${name}: ${parsed.self}% (Gruppentipp: ${parsed.guessAvg}%)`
          })
          .filter(Boolean)
        if (specAnswers.length > 0) {
          lines.push(`  Spektrum${poleInfo}: ${specAnswers.join(' | ')}`)
        }
      } else if (
        w.prompt_type === 'memory' ||
        w.prompt_type === 'logic' ||
        w.prompt_type === 'scramble'
      ) {
        const chalSummary = responses
          .map((r: any) => {
            if (typeof r?.content !== 'string') return null
            const parsed = parseChallengeResponse(r.content)
            const name =
              r?.members?.name || (r?.member_id ? memberMap.get(r.member_id) : null) || 'Freund'
            return `${name}: ${
              parsed.passed
                ? `Geschafft (${(parsed.timeMs / 1000).toFixed(1)}s)`
                : 'Trostpflaster 🩹'
            }`
          })
          .filter(Boolean)
        if (chalSummary.length > 0) {
          lines.push(`  Kniffel-Ergebnis: ${chalSummary.join(' | ')}`)
        }
      }

      const echo = extractEcho(w.options || null)
      if (echo) {
        lines.push(`  KI-Echo dieser Runde: "${echo}"`)
      }

      return lines.join('\n')
    })
    .join('\n\n')
}

function parseAiJsonSafely(rawText: string): any | null {
  if (!rawText) return null
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}

export async function generateWaveContent(
  previousWaves: any[],
  memberList: { id: string; name: string }[],
  nextNumber: number,
  forcedFormat?: CoreWaveType
): Promise<{ prompt: string; prompt_type: CoreWaveType; options: string[] | null }> {
  const allowedFormats = computeAllowedFormats(previousWaves)
  const chosenFormat = forcedFormat
    ? CORE_FORMATS.find(f => f.type === forcedFormat) || allowedFormats[0]
    : allowedFormats[Math.floor(Math.random() * allowedFormats.length)]

  // For 'scramble', alternate strictly between 'word' and 'numbers' based on the last scramble wave
  const lastScrambleWave = (previousWaves || []).find(w => w.prompt_type === 'scramble')
  const lastScrambleMode = lastScrambleWave
    ? extractScrambleConfig(lastScrambleWave.options, 'check').mode
    : nextNumber % 2 === 0
    ? 'numbers'
    : 'word'
  const nextScrambleMode: 'word' | 'numbers' =
    lastScrambleMode === 'word' ? 'numbers' : 'word'

  // If scramble mode is 'numbers', we can deterministically build the 3-number sum puzzle right away
  if (chosenFormat.type === 'scramble' && nextScrambleMode === 'numbers') {
    const numConfig = buildDeterministicNumberScramble(`wave-num-${nextNumber}`)
    return {
      prompt: `35s-Zahlen-Kombination: Wähle genau 3 Zahlen-Kacheln aus, die zusammen exakt ${numConfig.targetSum} ergeben!`,
      prompt_type: 'scramble',
      options: attachScrambleConfigToOptions(null, numConfig),
    }
  }

  const groupMemoryText = buildGroupMemoryContext(previousWaves, memberList)
  const memberNames =
    memberList && memberList.length > 0
      ? memberList.map(m => m.name).join(', ')
      : 'Freundeskreis'

  const pastSameFormatPrompts = (previousWaves || [])
    .filter(w => w.prompt_type === chosenFormat.type && typeof w.prompt === 'string')
    .map(w => `- "${w.prompt}"`)
    .slice(0, 20)

  const forbiddenBlock =
    pastSameFormatPrompts.length > 0
      ? `\nSTRIKTES WIEDERHOLUNGS-VERBOT FÜR "${chosenFormat.type}":\nDiese Aufgaben wurden bereits gestellt und dürfen UNTER KEINEN UMSTÄNDEN wiederholt oder fast identisch umformuliert werden:\n${pastSameFormatPrompts.join('\n')}\nDenk dir zwingend ein komplett neues, frisches Motiv / Thema aus!\n`
      : ''

  const MOODS = [
    'Scharfsinnig, frech & selbstironisch – ehrliche Alltagsmomente ohne Filter',
    'Charmant provokant & psychologisch – Fragen, bei denen man sofort wissen will, was die anderen sagen',
    'Spontan, verspielt & leicht schräg – bringt die Runde sofort zum Schmunzeln',
    'Warmherzig, direkt & verbindend – echte Freundschaftsdynamik komplett ohne Kitsch',
  ]
  const chosenMood = MOODS[nextNumber % MOODS.length]

  const systemPrompt = `Du bist der lernfähige KI-Spielleiter und Impulsgeber der App "Welle" für diesen festen Freundeskreis (${memberNames}).
Erstelle die nächste Welle (#${nextNumber}).

TONALITÄT: ${chosenMood}

KONTINUIERLICHES GRUPPEN-GEDÄCHTNIS (LERN-MODUS):
Hier sind die letzten Wellen inklusive der echten Antworten, Spektrum-Werte und Dynamiken dieser Gruppe:
${groupMemoryText}
${forbiddenBlock}
WIE DU DARAUS LERNST:
1. Analysiere den Humor, die Insider-Themen, die Lebenswelt, kleine Ticks und spannende Kontraste aus den bisherigen Antworten der Freunde.
2. Entwickle die Impulse organisch weiter: Knüpfe subtil an den Vibe, die Themenfelder oder Reibungspunkte der Gruppe an, OHNE jemanden im Fragetext namentlich bloßzustellen und OHNE eine alte Aufgabe zu wiederholen.
3. Keine kitschigen Kalendersprüche, kein geschwollenes Pathos, keine Erwähnung einer bestimmten Gruppengröße.

GEFORDERTES FORMAT: "${chosenFormat.type}" (${chosenFormat.desc})

${
  chosenFormat.type === 'undercover'
    ? `Erzeuge:
- "prompt": Eine spannende, unverdächtige Alltags- oder Meinungsfrage für die Gruppe, passend zu ihrem bisherigen Vibe.
- "glitch_prompt": Eine konkrete, witzige Geheim-Anweisung für den Maulwurf (1 Satz, direkt per "Du" formuliert), wie er seine Antwort subtil sabotieren oder in eine bestimmte schräge Richtung lenken soll, ohne aufzufliegen.
- "options": null`
    : chosenFormat.type === 'spectrum'
    ? `Erzeuge:
- "prompt": Eine knackige Frage zum heutigen Zustand, Kopfgefühl oder Charakter-Pendel, inspiriert vom Stil der Gruppe.
- "options": Genau 2 extrem bildhafte, gegensätzliche Pole als Array: ["Pol bei 0%", "Pol bei 100%"].
- "glitch_prompt": null`
    : chosenFormat.type === 'memory'
    ? `Erzeuge:
- "prompt": Einen kurzen, anspornenden 1-Satz-Impuls für den 35-Sekunden-Gedächtnis-Tresor (6 leuchtende Zahlen auf dem 4x4-Feld merken und blind antippen – wer patzt, kriegt das Trostpflaster).
- "options": null
- "glitch_prompt": null`
    : chosenFormat.type === 'logic'
    ? `Erzeuge eine wasserdichte, kurze Logik-Kopfnuss oder kognitive Fangfrage (max. 35 Wörter, in 35 Sekunden lösbar):
- "prompt": Die präzise Rätsel- oder Logikfrage.
- "logic_choices": Array mit genau 4 kurzen Antwortmöglichkeiten ["Option A", "Option B", "Option C", "Option D"].
- "correct_index": Zahl (0, 1, 2 oder 3) für die einzig logisch richtige Antwort.
- "explanation": 1 prägnanter Satz, warum genau diese Antwort stimmt.`
    : chosenFormat.type === 'scramble'
    ? `Erzeuge ein 35-Sekunden-Buchstabensalat-Rätsel mit einem bekannten deutschen Alltagswort:
- "prompt": "35s-Buchstabensalat: Bringe die Buchstaben in die richtige Reihenfolge!"
- "solution_word": Ein einzelnes, sofort bekanntes deutsches Nomen aus dem Alltag mit 5 bis 9 Buchstaben (nur A-Z ohne Sonderzeichen, z.B. URLAUB, KOPFKINO, PIZZA, SONNTAG, KINOABEND, WEcker -> WECKER).
- "hint": Eine klare, leicht verständliche Beschreibung des gesuchten Wortes (4 bis 8 Wörter, sodass jeder sofort weiß, wonach gesucht wird).`
    : chosenFormat.type === 'draw'
    ? `Erzeuge eine komplett neue, originelle und witzige 35-Sekunden-Zeichenaufgabe ("prompt"):
- WICHTIG: Erfinde jedes Mal ein neues, konkretes und überraschendes Zeichen-Motiv (z.B. eine bestimmte Alltagsszene, ein absurdes Mischwesen, eine geheime Superkraft, euer nächstes Gruppen-Abenteuer, ein Seelenzustand als Gegenstand, ein skurriles Gericht etc. – gerne inspiriert von Themen aus dem Gruppen-Gedächtnis!).
- Formuliere die Anweisung direkt mit "Zeichne..." oder "Skizziere..." in 1 prägnanten Satz (max. 20 Wörter).
- Wiederhole NIEMALS "Wetterphänomen", "Tier für deine Laune", "Kopf nach links drehen" oder andere bereits gespielte Motive!
- "options": null
- "glitch_prompt": null`
    : chosenFormat.type === 'photo'
    ? `Erzeuge:
- "prompt": Einen spontanen, witzigen oder atmosphärischen Foto-Impuls für die Live-Kamera aus der unmittelbaren Umgebung (komplett neu & abwechslungsreich).
- "options": null
- "glitch_prompt": null`
    : `Erzeuge:
- "prompt": Eine direkte, entlarvende oder herrlich ehrliche Frage für eine anonyme Blind-Beichte (max. 22 Wörter), die aus dem bisherigen Gruppen-Gedächtnis heraus den nächsten spannenden Nerv trifft.
- "options": null
- "glitch_prompt": null`
}

Antworte NUR als valides JSON:
{
  "prompt": "...",
  "prompt_type": "${chosenFormat.type}",
  "options": ${chosenFormat.type === 'spectrum' ? '["Pol A", "Pol B"]' : 'null'},
  "glitch_prompt": ${chosenFormat.type === 'undercover' ? '"..."' : 'null'},
  "logic_choices": ${chosenFormat.type === 'logic' ? '["A", "B", "C", "D"]' : 'null'},
  "correct_index": ${chosenFormat.type === 'logic' ? '0' : 'null'},
  "explanation": ${chosenFormat.type === 'logic' ? '"..."' : 'null'},
  "solution_word": ${chosenFormat.type === 'scramble' ? '"WORT"' : 'null'},
  "hint": ${chosenFormat.type === 'scramble' ? '"..."' : 'null'}
}`

  let parsed: any = null

  if (geminiApiKey && geminiApiKey.startsWith('AIza')) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.95,
          },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
        parsed = parseAiJsonSafely(rawText)
      }
    } catch (e) {
      console.warn('[Wave] Gemini call failed:', e)
    }
  }

  if (!parsed || !parsed.prompt) {
    try {
      const res = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          model: 'openai',
          seed: nextNumber * 137 + (Date.now() % 1000),
          messages: [
            {
              role: 'system',
              content:
                'Du bist ein kreativer deutschsprachiger Spielleiter. Du antwortest ausschließlich mit validem JSON ohne Markdown-Formatierung.',
            },
            { role: 'user', content: systemPrompt },
          ],
          temperature: 0.95,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const rawText = data?.choices?.[0]?.message?.content || ''
        parsed = parseAiJsonSafely(rawText)
      }
    } catch (e) {
      console.warn('[Wave] Secondary AI fallback failed:', e)
    }
  }

  const pastPromptsSet = new Set((previousWaves || []).map(w => (w.prompt || '').trim()))

  if (
    parsed &&
    typeof parsed.prompt === 'string' &&
    parsed.prompt.trim().length > 5 &&
    !pastPromptsSet.has(parsed.prompt.trim())
  ) {
    parsed.prompt = parsed.prompt.trim()
    parsed.prompt_type = chosenFormat.type
  } else {
    // Fallback auf den erweiterten Premium-Pool nur, wenn KI ausfällt oder ein Duplikat liefert
    const pool = CURATED_PROMPTS.filter(p => p.prompt_type === chosenFormat.type)
    const freshPool = pool.filter(p => !pastPromptsSet.has(p.prompt))
    const selectedPool = freshPool.length > 0 ? freshPool : pool
    parsed = {
      ...(selectedPool[nextNumber % selectedPool.length] || CURATED_PROMPTS[0]),
    }
  }

  let finalOptions: string[] | null = Array.isArray(parsed.options) ? parsed.options : null

  if (chosenFormat.type === 'spectrum' && (!finalOptions || finalOptions.length < 2)) {
    finalOptions = ['0% Minimal-Modus', '100% Maximal-Ausschlag']
  }

  if (chosenFormat.type === 'undercover' && memberList.length >= 2) {
    const undercoverPrompt =
      parsed.glitch_prompt ||
      'Schmuggle eine charmante Notlüge oder das genaue Gegenteil deiner echten Meinung ein – aber tarne dich perfekt!'
    const luckyMember = memberList[Math.floor(Math.random() * memberList.length)]
    finalOptions = attachUndercoverToOptions(null, luckyMember.id, luckyMember.name, undercoverPrompt)
  }

  if (chosenFormat.type === 'logic') {
    if (
      Array.isArray(parsed.logic_choices) &&
      parsed.logic_choices.length >= 2 &&
      typeof parsed.correct_index === 'number' &&
      parsed.correct_index >= 0 &&
      parsed.correct_index < parsed.logic_choices.length
    ) {
      finalOptions = attachLogicConfigToOptions(null, {
        choices: parsed.logic_choices.slice(0, 4).map((c: any) => String(c)),
        correctIndex: parsed.correct_index,
        explanation:
          typeof parsed.explanation === 'string' && parsed.explanation.trim()
            ? parsed.explanation.trim()
            : 'Diese Antwort folgt zwingend aus den Hinweisen.',
      })
    } else {
      const freshRiddles = CURATED_LOGIC_RIDDLES.filter(r => !pastPromptsSet.has(r.prompt))
      const rPool = freshRiddles.length > 0 ? freshRiddles : CURATED_LOGIC_RIDDLES
      const chosenRiddle = rPool[nextNumber % rPool.length]
      parsed.prompt = chosenRiddle.prompt
      finalOptions = attachLogicConfigToOptions(null, chosenRiddle.config)
    }
  }

  if (chosenFormat.type === 'scramble') {
    const fallbackItem = CURATED_WORD_SCRAMBLES[nextNumber % CURATED_WORD_SCRAMBLES.length]
    const rawWord =
      typeof parsed.solution_word === 'string' && parsed.solution_word.trim().length >= 4
        ? parsed.solution_word.trim()
        : fallbackItem.word
    const rawHint =
      typeof parsed.hint === 'string' && parsed.hint.trim().length > 2
        ? parsed.hint.trim()
        : fallbackItem.hint

    const wordConfig = buildDeterministicWordScramble(
      rawWord,
      rawHint,
      `wave-word-${nextNumber}`
    )
    parsed.prompt = `Buchstabensalat (${wordConfig.solutionWord?.length} Buchstaben): „${wordConfig.hint}“`
    finalOptions = attachScrambleConfigToOptions(null, wordConfig)
  }

  return {
    prompt: parsed.prompt,
    prompt_type: chosenFormat.type,
    options: finalOptions,
  }
}

/**
 * Lädt die letzten Wellen und Antworten, OHNE jemals riesige Base64-Bilder (draw/photo)
 * über das Netzwerk zu ziehen.
 */
async function fetchHistoryAndMembers() {
  const [{ data: waveRows }, { data: members }] = await Promise.all([
    supabase
      .from('waves')
      .select('id, number, prompt, prompt_type, options')
      .order('number', { ascending: false })
      .limit(30),
    supabase.from('members').select('id, name'),
  ])

  const wavesList = waveRows || []
  const nonImageWaveIds = wavesList
    .filter(w => w.prompt_type !== 'draw' && w.prompt_type !== 'photo')
    .slice(0, 10)
    .map(w => w.id)

  let responsesByWaveId = new Map<string, any[]>()
  if (nonImageWaveIds.length > 0) {
    const { data: respRows } = await supabase
      .from('responses')
      .select('wave_id, content, member_id, members(name)')
      .in('wave_id', nonImageWaveIds)

    for (const r of respRows || []) {
      if (typeof r.content === 'string' && r.content.startsWith('data:image')) continue
      const list = responsesByWaveId.get(r.wave_id) || []
      list.push(r)
      responsesByWaveId.set(r.wave_id, list)
    }
  }

  const previousWaves = wavesList.map(w => ({
    ...w,
    responses: responsesByWaveId.get(w.id) || [],
  }))

  return { previousWaves, members: members || [] }
}

export async function prepareWaveContent(
  waveId?: string
): Promise<{ success: boolean; prepared?: boolean; alreadyPrepared?: boolean; wave?: any }> {
  let waveToPrepare: any = null
  if (waveId) {
    const { data } = await supabase.from('waves').select('*').eq('id', waveId).single()
    waveToPrepare = data
  } else {
    const { data } = await supabase.from('waves').select('*').order('number', { ascending: false }).limit(1)
    waveToPrepare = data?.[0]
  }

  if (!waveToPrepare) return { success: false }

  const { previousWaves, members } = await fetchHistoryAndMembers()

  const existing = extractPreparedWave(waveToPrepare.options)
  const allowedFormats = computeAllowedFormats(previousWaves)

  if (existing && allowedFormats.some(f => f.type === existing.prompt_type)) {
    return { success: true, alreadyPrepared: true, wave: waveToPrepare }
  }

  const nextNumber = waveToPrepare.number + 1
  const preparedContent = await generateWaveContent(previousWaves, members, nextNumber)

  const updatedOptions = attachPreparedWaveToOptions(waveToPrepare.options, preparedContent)
  await supabase.from('waves').update({ options: updatedOptions }).eq('id', waveToPrepare.id)

  return { success: true, prepared: true, wave: waveToPrepare }
}

let isActivatingWaveInMemory = false

export async function activateWaveInternal(
  force = false,
  forcedFormat?: CoreWaveType
): Promise<{
  success: boolean
  wave?: any
  deduplicated?: boolean
  inProgress?: boolean
  message?: string
}> {
  if (!force && isActivatingWaveInMemory) {
    return { success: true, inProgress: true }
  }

  if (!force) {
    isActivatingWaveInMemory = true
  }

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

        if (topWave.status === 'cooldown' && topWave.next_wave_at) {
          const isTimeUp = new Date(topWave.next_wave_at).getTime() <= Date.now()
          if (!isTimeUp) {
            return { success: false, message: 'Cooldown noch aktiv', wave: topWave }
          }

          // Wichtig: KEIN Update auf next_wave_at (+12s), damit der Cooldown-Counter
          // im Frontend niemals von 00:00:00 wieder auf 00:00:11 hochspringt!
          const alreadyClaimed = Array.isArray(topWave.options)
            ? topWave.options.includes('__activating_wave__')
            : false
          if (alreadyClaimed) {
            return { success: true, wave: topWave, inProgress: true }
          }

          const claimOptions = [...(topWave.options || []), '__activating_wave__']
          await supabase
            .from('waves')
            .update({ options: claimOptions })
            .eq('id', topWave.id)
            .eq('status', 'cooldown')
        }
      }
    }

    const { previousWaves, members } = await fetchHistoryAndMembers()

    const nextNumber =
      previousWaves && previousWaves.length > 0
        ? Math.max(...previousWaves.map(w => w.number)) + 1
        : 1

    const cachedPrepared = topWave ? extractPreparedWave(topWave.options) : null
    const allowedFormats = computeAllowedFormats(previousWaves)
    const isCachedValid =
      !forcedFormat &&
      cachedPrepared &&
      allowedFormats.some(f => f.type === cachedPrepared.prompt_type)

    let content: { prompt: string; prompt_type: string; options: string[] | null }

    if (isCachedValid && !force) {
      content = cachedPrepared
    } else {
      content = await generateWaveContent(
        previousWaves,
        members,
        nextNumber,
        forcedFormat
      )
    }

    const formatBadge =
      content.prompt_type === 'undercover'
        ? '🕵️ Sabotage-Welle'
        : content.prompt_type === 'spectrum'
        ? '🎚️ Frequenz-Spektrum'
        : content.prompt_type === 'memory'
        ? '🧠 35s-Gedächtnis-Tresor'
        : content.prompt_type === 'logic'
        ? '🧩 35s-Logik-Falle'
        : content.prompt_type === 'scramble'
        ? '⚡ 35s-Kniffel-Sprint'
        : content.prompt_type === 'draw'
        ? '🎨 35s-Blindfunk'
        : content.prompt_type === 'photo'
        ? '📸 Live-Schnappschuss'
        : '🔒 Blind-Beichte'

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
          title: `Welle #${nextNumber} · ${formatBadge}`,
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
    throw error
  } finally {
    if (!force) {
      isActivatingWaveInMemory = false
    }
  }
}
