import { supabase } from '@/lib/supabase'

export const CONFIG_WAVE_ID = '00000000-0000-0000-0000-000000000000'
export const MAX_COOLDOWN_SECONDS = 24 * 60 * 60 // Max 24 Stunden = 86.400 Sekunden
export const MIN_COOLDOWN_SECONDS = 5

export interface AppConfig {
  cooldownSeconds: number
}

/**
 * Formatiert Sekunden lesbar auf Deutsch (z. B. "24 Std.", "1 Std. 30 Min.", "15 Min.", "10 Sek.")
 */
export function formatCooldownDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds} Sekunden`
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} Std.`)
  if (minutes > 0) parts.push(`${minutes} Min.`)
  if (seconds > 0 && hours === 0) parts.push(`${seconds} Sek.`)
  return parts.join(' ') || `${totalSeconds}s`
}

/**
 * Lädt die globale Konfiguration aus Supabase (persistente Config-Welle #0).
 */
export async function getAppConfig(): Promise<AppConfig> {
  try {
    const { data } = await supabase
      .from('waves')
      .select('options')
      .eq('id', CONFIG_WAVE_ID)
      .maybeSingle()

    if (data && Array.isArray(data.options)) {
      for (const opt of data.options) {
        if (typeof opt === 'string' && opt.startsWith('__config__:cooldown_seconds=')) {
          const val = parseInt(opt.replace('__config__:cooldown_seconds=', ''), 10)
          if (!isNaN(val) && val >= MIN_COOLDOWN_SECONDS) {
            return {
              cooldownSeconds: Math.min(val, MAX_COOLDOWN_SECONDS),
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[getAppConfig] Error fetching config:', err)
  }

  // Fallback: Umgebungsvariable NEXT_PUBLIC_DEFAULT_COOLDOWN_SECONDS oder 10s (Test)
  const envVal = parseInt(process.env.NEXT_PUBLIC_DEFAULT_COOLDOWN_SECONDS || '10', 10)
  const defaultSec = isNaN(envVal)
    ? 10
    : Math.min(Math.max(envVal, MIN_COOLDOWN_SECONDS), MAX_COOLDOWN_SECONDS)
  return { cooldownSeconds: defaultSec }
}

/**
 * Speichert die globale Konfiguration in Supabase.
 */
export async function saveAppConfig(config: AppConfig): Promise<void> {
  const clamped = Math.min(
    Math.max(config.cooldownSeconds, MIN_COOLDOWN_SECONDS),
    MAX_COOLDOWN_SECONDS
  )
  const options = [`__config__:cooldown_seconds=${clamped}`]

  const { error } = await supabase.from('waves').upsert({
    id: CONFIG_WAVE_ID,
    number: 0,
    prompt: '__APP_CONFIG__',
    prompt_type: 'text',
    options,
    status: 'active',
  })

  if (error) {
    console.error('[saveAppConfig] Error saving config:', error)
    throw error
  }
}
