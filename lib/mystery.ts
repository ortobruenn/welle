export interface GlitchInfo {
  memberId: string
  memberName?: string
  prompt: string
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

export function cleanOptions(options: string[] | null): string[] | null {
  if (!options || !Array.isArray(options)) return null
  const cleaned = options.filter(
    o => typeof o === 'string' && !o.startsWith('__echo__:') && !o.startsWith('__glitch__:')
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
