export interface GlitchInfo {
  memberId: string
  memberName?: string
  prompt: string
}

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

export function extractGlitch(options: string[] | null): GlitchInfo | null {
  if (!options || !Array.isArray(options)) return null
  const item = options.find(o => typeof o === 'string' && o.startsWith('__glitch__:'))
  if (!item) return null
  
  const raw = item.slice('__glitch__:'.length)
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

export function extractEnigma(options: string[] | null): EnigmaData | null {
  if (!options || !Array.isArray(options)) return null
  const solItem = options.find(o => typeof o === 'string' && o.startsWith('__solution__:'))
  if (!solItem) return null
  const solution = solItem.slice('__solution__:'.length).trim().toUpperCase()
  const hintItem = options.find(o => typeof o === 'string' && o.startsWith('__hint__:'))
  const hint = hintItem ? hintItem.slice('__hint__:'.length).trim() : undefined
  const fragments = options.filter(
    o => typeof o === 'string' && !o.startsWith('__')
  )
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
      // ignore parse error
    }
  }
  return items.length > 0 ? items : null
}

export function buildVibeOptions(items: VibeItem[]): string[] {
  return items.map(item => `__vibe__:${JSON.stringify(item)}`)
}

export function cleanOptions(options: string[] | null): string[] | null {
  if (!options || !Array.isArray(options)) return null
  const cleaned = options.filter(
    o => typeof o === 'string' &&
      !o.startsWith('__echo__:') &&
      !o.startsWith('__glitch__:') &&
      !o.startsWith('__solution__:') &&
      !o.startsWith('__hint__:') &&
      !o.startsWith('__vibe__:') &&
      !o.startsWith('__prepared_wave__:')
  )
  return cleaned.length > 0 ? cleaned : null
}

export function attachEchoToOptions(options: string[] | null, echo: string): string[] {
  const filtered = (options || []).filter(o => !o.startsWith('__echo__:'))
  return [...filtered, `__echo__:${echo.trim()}`]
}

export function attachGlitchToOptions(
  options: string[] | null,
  memberId: string,
  memberName: string,
  glitchPrompt: string
): string[] {
  const filtered = (options || []).filter(o => !o.startsWith('__glitch__:'))
  return [`__glitch__:${memberId}:${memberName}:${glitchPrompt.trim()}`, ...filtered]
}

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
  const filtered = (options || []).filter(o => typeof o === 'string' && !o.startsWith('__prepared_wave__:'))
  return [...filtered, `__prepared_wave__:${JSON.stringify(data)}`]
}
