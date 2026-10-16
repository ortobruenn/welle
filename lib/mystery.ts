import type {
  SpectrumResponsePayload,
  WaveReaction,
  ChallengeResponsePayload,
  LogicWaveConfig,
  ScrambleWaveConfig,
} from './types'

export interface UndercoverInfo {
  memberId: string
  memberName?: string
  prompt: string
}

export type GlitchInfo = UndercoverInfo

export interface EnigmaData {
  solution: string
  hint?: string
  fragments: string[]
}

export function extractEcho(options: string[] | null): string | null {
  if (!options || !Array.isArray(options)) return null
  const item = options.find(o => typeof o === 'string' && o.startsWith('__echo__:'))
  return item ? item.slice('__echo__:'.length).trim() : null
}

export function attachEchoToOptions(options: string[] | null, echo: string): string[] {
  const filtered = (options || []).filter(o => typeof o === 'string' && !o.startsWith('__echo__:'))
  return [...filtered, `__echo__:${echo.trim()}`]
}

export function extractUndercover(options: string[] | null): UndercoverInfo | null {
  if (!options || !Array.isArray(options)) return null

  // 1. Check structured JSON token first
  const jsonItem = options.find(o => typeof o === 'string' && o.startsWith('__undercover_json__:'))
  if (jsonItem) {
    try {
      const parsed = JSON.parse(jsonItem.slice('__undercover_json__:'.length))
      if (parsed && parsed.memberId && parsed.prompt) {
        return parsed as UndercoverInfo
      }
    } catch {
      // fallback to legacy
    }
  }

  // 2. Fallback to legacy colon-separated string
  const item = options.find(
    o => typeof o === 'string' && (o.startsWith('__undercover__:') || o.startsWith('__glitch__:'))
  )
  if (!item) return null

  const prefix = item.startsWith('__undercover__:') ? '__undercover__:' : '__glitch__:'
  const raw = item.slice(prefix.length)
  const parts = raw.split(':')
  if (parts.length >= 3) {
    const memberId = parts[0]
    const memberName = parts[1]
    const prompt = parts.slice(2).join(':')
    return { memberId, memberName, prompt }
  } else if (parts.length === 2) {
    const memberId = parts[0]
    const prompt = parts[1]
    return { memberId, prompt }
  }
  return null
}

export const extractGlitch = extractUndercover

export function attachUndercoverToOptions(
  options: string[] | null,
  memberId: string,
  memberName: string,
  undercoverPrompt: string
): string[] {
  const filtered = (options || []).filter(
    o =>
      typeof o === 'string' &&
      !o.startsWith('__undercover_json__:') &&
      !o.startsWith('__undercover__:') &&
      !o.startsWith('__glitch__:')
  )
  const payload: UndercoverInfo = {
    memberId,
    memberName,
    prompt: undercoverPrompt.trim(),
  }
  return [`__undercover_json__:${JSON.stringify(payload)}`, ...filtered]
}

export const attachGlitchToOptions = attachUndercoverToOptions

export function generateDynamicGlitchPrompt(promptText: string = '', seed: number = Date.now()): string {
  const dynamicMissions = [
    'Behaupte felsenfest das genaue Gegenteil deiner echten Meinung, aber begründe es mit verblüffender Ruhe!',
    'Schmuggle unauffällig eine völlig absurde persönliche Marotte ein und verkaufe sie als das Normalste der Welt!',
    'Baue beiläufig ein maßlos übertriebenes oder frei erfundenes Detail ein, ohne dass es sofort auffliegt!',
    'Formuliere deine Antwort mit geschwollener Pseudo-Weisheit, als wärst du ein weltfremder Guru!',
    'Verteidige eine offensichtlich fragwürdige Ansicht so charmant und leidenschaftlich, dass die anderen ins Grübeln geraten!',
    'Gib eine Antwort ab, die auf den ersten Blick seriös klingt, bei genauem Hinhören aber herrlich schräg ist!',
    'Schmuggle ein völlig deplatziertes Alltags-Element oder ein unpassendes Tier als Schlüsselargument ein!',
    'Erfinde eine angebliche wissenschaftliche Studie oder Weisheit deiner Großmutter zur unanfechtbaren Untermauerung!',
    'Beantworte die Frage mit maximalem Ernst, aber verpacke ein subtiles Tabu als den einzig logischen Weg!',
    'Tarne deine Antwort wie einen geheimen Insider-Tipp aus dubiosen Quellen!',
    'Lobe eine extrem nervige Sache über den grünen Klee, als hätte sie dein Leben gerettet!',
    'Schreibe so, als wärst du ein arroganter Kunstkritiker, der über die Frage doziert!',
    'Erfinde eine haarsträubende Anekdote, die angeblich deinem Cousin dritten Grades passiert ist!',
    'Schlage eine sozial höchst fragwürdige Lösung vor, aber tarne sie als die reinste Form von Effizienz!',
  ]

  const lower = promptText.toLowerCase()
  if (lower.includes('essen') || lower.includes('gericht') || lower.includes('küche')) {
    dynamicMissions.push(
      'Nenne eine kulinarisch völlig abwegige Kombination, aber verteidige sie wie ein Sternekoch!'
    )
  }
  if (lower.includes('geld') || lower.includes('kauf') || lower.includes('invest')) {
    dynamicMissions.push(
      'Verkaufe einen völlig nutzlosen Gegenstand als die beste Investition deines Lebens!'
    )
  }

  const idx = Math.abs(Math.floor(seed)) % dynamicMissions.length
  return dynamicMissions[idx]
}

export function generateDynamicSpectrumPoles(promptText: string = '', seed: number = Date.now()): [string, string] {
  const dynamicPoleSets: Array<[string, string]> = [
    ['0% Minimal-Notstrom', '100% Maximaler Tatendrang'],
    ['Eremit im Zen-Kloster', 'Rampensau auf der Hauptbühne'],
    ['Eiskalte Fakten & Excel', 'Reines Bauchgefühl & Chaos-Vertrauen'],
    ['Pyjama mental schon angezogen', 'Schon mit einem Fuß vor der Tür'],
    ['Geduldsfaden aus Spinnweben', 'Unerschütterlicher Fels in der Brandung'],
    ['Völlige Tiefenentspannung', '37 Tabs offen & Notfall-Kaffee'],
    ['Jedes Detail pedantisch durchgeplant', 'Wir schauen einfach, was passiert'],
    ['Akute soziale Überdosis', 'Brauche dringend Menschen um mich'],
    ['Extrem sparsam & vernünftig', 'Gönnung ohne Reue & Kreditkarte glüht'],
    ['Absoluter Morgenmuffel', 'Um 6 Uhr früh schon die Welt gerettet'],
    ['Verstand kontrolliert alles', 'Herz schlägt wild ohne Filter'],
    ['Absolute Komfortzone', 'Mitten ins nächste Abenteuer'],
  ]

  const lower = promptText.toLowerCase()
  if (lower.includes('energie') || lower.includes('akku') || lower.includes('müde') || lower.includes('wach')) {
    return ['1% Notstrom & Bettdecke', '120% Espresso-Rausch & Überflieger']
  }
  if (lower.includes('kopf') || lower.includes('gedanken') || lower.includes('fokus')) {
    return ['Zen-Garten & absolute Stille', 'Tornado im Kopf & 50 offene Baustellen']
  }
  if (lower.includes('sozial') || lower.includes('menschen') || lower.includes('party')) {
    return ['Höhlenmensch – bitte nicht ansprechen', 'Bühne frei – wo steigt das Fest?!']
  }
  if (lower.includes('entscheidung') || lower.includes('plan')) {
    return ['Pedantische Risikoanalyse', 'Münzwurf & Augen zu']
  }
  if (lower.includes('spontan')) {
    return ['Terminkalender hermetisch abgeriegelt', 'In 5 Minuten abfahrtbereit']
  }

  const idx = Math.abs(Math.floor(seed)) % dynamicPoleSets.length
  return dynamicPoleSets[idx]
}

// ---------------------------------------------------------------------------
// LIVE REACTIONS (Sparks on Reveal Cards)
// ---------------------------------------------------------------------------
export type WaveReactionsMap = Record<string, WaveReaction[]> // responseId -> reactions

export function extractReactions(options: string[] | null): WaveReactionsMap {
  if (!options || !Array.isArray(options)) return {}
  const item = options.find(o => typeof o === 'string' && o.startsWith('__reactions__:'))
  if (!item) return {}
  try {
    return JSON.parse(item.slice('__reactions__:'.length)) || {}
  } catch {
    return {}
  }
}

export function attachReactionToOptions(
  options: string[] | null,
  responseId: string,
  reaction: WaveReaction
): string[] {
  const current = extractReactions(options)
  const list = current[responseId] || []
  const existingIdx = list.findIndex(
    r => r.memberId === reaction.memberId && r.emoji === reaction.emoji
  )

  if (existingIdx >= 0) {
    // Toggle off if same emoji clicked again
    list.splice(existingIdx, 1)
  } else {
    // One active reaction per member per card for clean UI
    const withoutMember = list.filter(r => r.memberId !== reaction.memberId)
    withoutMember.push(reaction)
    current[responseId] = withoutMember
  }

  if (existingIdx >= 0) {
    current[responseId] = list
  }

  const filtered = (options || []).filter(
    o => typeof o === 'string' && !o.startsWith('__reactions__:')
  )
  return [...filtered, `__reactions__:${JSON.stringify(current)}`]
}

// ---------------------------------------------------------------------------
// LIVE UNDERCOVER VOTES (voterMemberId -> suspectedMemberId)
// ---------------------------------------------------------------------------
export type UndercoverVotesMap = Record<string, string>

export function extractUndercoverVotes(options: string[] | null): UndercoverVotesMap {
  if (!options || !Array.isArray(options)) return {}
  const item = options.find(o => typeof o === 'string' && o.startsWith('__votes__:'))
  if (!item) return {}
  try {
    return JSON.parse(item.slice('__votes__:'.length)) || {}
  } catch {
    return {}
  }
}

export function attachUndercoverVoteToOptions(
  options: string[] | null,
  voterMemberId: string,
  suspectMemberId: string
): string[] {
  const current = extractUndercoverVotes(options)
  current[voterMemberId] = suspectMemberId
  const filtered = (options || []).filter(
    o => typeof o === 'string' && !o.startsWith('__votes__:')
  )
  return [...filtered, `__votes__:${JSON.stringify(current)}`]
}

// ---------------------------------------------------------------------------
// SPECTRUM PAYLOAD HELPER (Self + Group Radar Guess)
// ---------------------------------------------------------------------------
export function parseSpectrumResponse(content: string): SpectrumResponsePayload {
  try {
    const parsed = JSON.parse(content)
    if (typeof parsed === 'object' && parsed !== null) {
      const rawSelf =
        typeof parsed.self === 'number'
          ? parsed.self
          : typeof parsed.value === 'number'
          ? parsed.value
          : 50
      const self = Math.max(0, Math.min(100, Math.round(rawSelf)))
      const guessAvg =
        typeof parsed.guessAvg === 'number'
          ? Math.max(0, Math.min(100, Math.round(parsed.guessAvg)))
          : self
      return { self, guessAvg }
    }
  } catch {
    // Fallback for plain number strings like "72"
  }
  const num = Number(content)
  const cleanVal = Number.isNaN(num) ? 50 : Math.max(0, Math.min(100, Math.round(num)))
  return { self: cleanVal, guessAvg: cleanVal }
}

export function serializeSpectrumResponse(
  self: number,
  guessAvg: number,
  poleA?: string,
  poleB?: string
): string {
  const s = Math.max(0, Math.min(100, Math.round(self)))
  const g = Math.max(0, Math.min(100, Math.round(guessAvg)))
  return JSON.stringify({
    self: s,
    value: s,
    guessAvg: g,
    poleA,
    poleB,
  })
}

// ---------------------------------------------------------------------------
// PREPARED WAVE CACHE (Zero-Latency Cooldown Transition)
// ---------------------------------------------------------------------------
export interface PreparedWaveData {
  prompt: string
  prompt_type: string
  options: string[] | null
}

export function extractPreparedWave(options: string[] | null): PreparedWaveData | null {
  if (!options || !Array.isArray(options)) return null
  const item = options.find(o => typeof o === 'string' && o.startsWith('__prepared_wave__:'))
  if (!item) return null
  try {
    return JSON.parse(item.slice('__prepared_wave__:'.length))
  } catch {
    return null
  }
}

export function attachPreparedWaveToOptions(
  options: string[] | null,
  data: PreparedWaveData
): string[] {
  const filtered = (options || []).filter(
    o => typeof o === 'string' && !o.startsWith('__prepared_wave__:')
  )
  return [...filtered, `__prepared_wave__:${JSON.stringify(data)}`]
}

// ---------------------------------------------------------------------------
// CLEAN OPTIONS & LEGACY HELPERS
// ---------------------------------------------------------------------------
export function cleanOptions(options: string[] | null): string[] | null {
  if (!options || !Array.isArray(options)) return null
  const cleaned = options.filter(o => typeof o === 'string' && !o.startsWith('__'))
  return cleaned.length > 0 ? cleaned : null
}

export function extractEnigma(options: string[] | null): EnigmaData | null {
  if (!options || !Array.isArray(options)) return null
  const solItem = options.find(o => typeof o === 'string' && o.startsWith('__solution__:'))
  if (!solItem) return null
  const solution = solItem.slice('__solution__:'.length).trim().toUpperCase()
  const hintItem = options.find(o => typeof o === 'string' && o.startsWith('__hint__:'))
  const hint = hintItem ? hintItem.slice('__hint__:'.length).trim() : undefined
  const fragments = options.filter(o => typeof o === 'string' && !o.startsWith('__'))
  return { solution, hint, fragments }
}

export function buildEnigmaOptions(solution: string, fragments: string[], hint?: string): string[] {
  const result = [`__solution__:${solution.toUpperCase().trim()}`]
  if (hint) result.push(`__hint__:${hint.trim()}`)
  result.push(...fragments)
  return result
}

export interface VibeItem {
  id: string
  title: string
  prompt: string
  imageUrl: string
}

export function extractVibeOptions(options: string[] | null): VibeItem[] | null {
  if (!options || !Array.isArray(options)) return null
  const vibeStrings = options.filter(o => typeof o === 'string' && o.startsWith('__vibe__:'))
  if (vibeStrings.length === 0) return null
  const items: VibeItem[] = []
  for (const s of vibeStrings) {
    try {
      const parsed = JSON.parse(s.slice('__vibe__:'.length))
      if (parsed && parsed.title && parsed.imageUrl) {
        items.push(parsed)
      }
    } catch {
      // ignore
    }
  }
  return items.length > 0 ? items : null
}

export function buildVibeOptions(items: VibeItem[]): string[] {
  return items.map(item => `__vibe__:${JSON.stringify(item)}`)
}

// ---------------------------------------------------------------------------
// CHALLENGE RESPONSE PAYLOAD (memory, logic, scramble)
// ---------------------------------------------------------------------------
export function serializeChallengeResponse(payload: ChallengeResponsePayload): string {
  return JSON.stringify({
    __challenge: true,
    passed: Boolean(payload.passed),
    timeMs: Math.max(100, Math.round(payload.timeMs || 0)),
    detail: payload.detail || (payload.passed ? 'Gelöst' : 'Nicht geschafft'),
    answer: payload.answer || '',
    progress: typeof payload.progress === 'number' ? payload.progress : payload.passed ? 100 : 0,
  })
}

export function parseChallengeResponse(content: string): ChallengeResponsePayload {
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && typeof parsed.passed === 'boolean') {
      return {
        passed: parsed.passed,
        timeMs: typeof parsed.timeMs === 'number' ? parsed.timeMs : 35000,
        detail:
          typeof parsed.detail === 'string'
            ? parsed.detail
            : parsed.passed
            ? 'Gelöst'
            : 'Trostpflaster',
        answer: typeof parsed.answer === 'string' ? parsed.answer : undefined,
        progress: typeof parsed.progress === 'number' ? parsed.progress : parsed.passed ? 100 : 0,
      }
    }
  } catch {
    // Fallback for plain text
  }
  return {
    passed: false,
    timeMs: 35000,
    detail: content || 'Trostpflaster',
    progress: 0,
  }
}

// ---------------------------------------------------------------------------
// DETERMINISTIC SEED HELPER (Equal conditions for all group members!)
// ---------------------------------------------------------------------------
export function createSeededRng(seedStr: string): () => number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateDeterministicMemoryLayout(seedStr: string, count = 6): number[] {
  const rng = createSeededRng(seedStr || 'welle-default-seed')
  const indices = Array.from({ length: 16 }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = indices[i]
    indices[i] = indices[j]
    indices[j] = tmp
  }
  return indices.slice(0, count)
}

// ---------------------------------------------------------------------------
// LOGIC WAVE CONFIG HELPERS
// ---------------------------------------------------------------------------
export function attachLogicConfigToOptions(
  options: string[] | null,
  config: LogicWaveConfig
): string[] {
  const filtered = (options || []).filter(
    o => typeof o === 'string' && !o.startsWith('__logic_json__:')
  )
  return [`__logic_json__:${JSON.stringify(config)}`, ...filtered]
}

export function extractLogicConfig(options: string[] | null): LogicWaveConfig {
  if (options && Array.isArray(options)) {
    const item = options.find(o => typeof o === 'string' && o.startsWith('__logic_json__:'))
    if (item) {
      try {
        const parsed = JSON.parse(item.slice('__logic_json__:'.length))
        if (
          parsed &&
          Array.isArray(parsed.choices) &&
          parsed.choices.length >= 2 &&
          typeof parsed.correctIndex === 'number'
        ) {
          return {
            choices: parsed.choices,
            correctIndex: parsed.correctIndex,
            explanation:
              parsed.explanation || 'Nur diese Option hält einer logischen Prüfung stand.',
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return {
    choices: ['5 Cent', '10 Cent', '1 Cent', '15 Cent'],
    correctIndex: 0,
    explanation:
      'Wenn der Ball 5 Cent kostet und der Schläger 1,00 € mehr (also 1,05 €), ergibt das zusammen exakt 1,10 €.',
  }
}

// ---------------------------------------------------------------------------
// SCRAMBLE WAVE CONFIG HELPERS (Word Scramble & Target-Sum Numbers)
// ---------------------------------------------------------------------------
export function attachScrambleConfigToOptions(
  options: string[] | null,
  config: ScrambleWaveConfig
): string[] {
  const filtered = (options || []).filter(
    o => typeof o === 'string' && !o.startsWith('__scramble_json__:')
  )
  return [`__scramble_json__:${JSON.stringify(config)}`, ...filtered]
}

export function buildDeterministicWordScramble(
  word: string,
  hint: string,
  seedStr: string
): ScrambleWaveConfig {
  const cleanWord = word
    .trim()
    .toUpperCase()
    .replace(/Ä/g, 'AE')
    .replace(/Ö/g, 'OE')
    .replace(/Ü/g, 'UE')
    .replace(/ß/g, 'SS')
    .replace(/[^A-Z]/g, '')
  const finalWord = cleanWord.length >= 4 ? cleanWord : 'KAFFEE'
  const rng = createSeededRng(seedStr + finalWord)
  const chars = finalWord.split('')
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = chars[i]
      chars[i] = chars[j]
      chars[j] = tmp
    }
    if (chars.join('') !== finalWord) break
  }
  return {
    mode: 'word',
    solutionWord: finalWord,
    scrambledLetters: chars,
    hint: hint || 'Bilde aus den Buchstaben das gesuchte Alltagswort!',
  }
}

export function buildDeterministicNumberScramble(seedStr: string): ScrambleWaveConfig {
  const rng = createSeededRng(seedStr || 'welle-num-seed')
  // Pick 9 distinct numbers between 4 and 29
  const pool: number[] = []
  for (let n = 4; n <= 29; n++) pool.push(n)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  const tiles = pool.slice(0, 9)
  // Pick 3 winning indices (0, 3, 7 shuffled)
  const idxPool = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  for (let i = idxPool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = idxPool[i]
    idxPool[i] = idxPool[j]
    idxPool[j] = tmp
  }
  const solutionIndices = idxPool.slice(0, 3).sort((a, b) => a - b)
  const targetSum =
    tiles[solutionIndices[0]] + tiles[solutionIndices[1]] + tiles[solutionIndices[2]]

  return {
    mode: 'numbers',
    targetSum,
    tiles,
    solutionIndices,
  }
}

export function extractScrambleConfig(
  options: string[] | null,
  seedStr = 'default'
): ScrambleWaveConfig {
  if (options && Array.isArray(options)) {
    const item = options.find(o => typeof o === 'string' && o.startsWith('__scramble_json__:'))
    if (item) {
      try {
        const parsed = JSON.parse(item.slice('__scramble_json__:'.length))
        if (parsed && (parsed.mode === 'word' || parsed.mode === 'numbers')) {
          return parsed as ScrambleWaveConfig
        }
      } catch {
        // ignore
      }
    }
  }
  return buildDeterministicNumberScramble(seedStr)
}

