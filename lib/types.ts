export interface Member {
  id: string
  name: string
  created_at: string
}

export type CoreWaveType =
  | 'text'
  | 'undercover'
  | 'spectrum'
  | 'draw'
  | 'photo'
  | 'memory'
  | 'logic'
  | 'scramble'

// Legacy types kept in union for graceful fallback of historic DB waves
export type WavePromptType =
  | CoreWaveType
  | 'choice'
  | 'pulse'
  | 'silence'
  | 'enigma'
  | 'vibe'

export type WaveFormat = WavePromptType

export interface Wave {
  id: string
  number: number
  prompt: string
  prompt_type: WavePromptType
  format?: WaveFormat
  options: string[] | null
  status: 'active' | 'reveal' | 'cooldown'
  created_at: string
  revealed_at: string | null
  next_wave_at: string | null
}

export interface WaveResponse {
  id: string
  wave_id: string
  member_id: string
  content: string // Text, JSON-Payload (Spectrum / Challenge) oder Bild-DataURL
  created_at: string
  members?: Member
}

export interface SpectrumResponsePayload {
  self: number // 0..100
  guessAvg: number // 0..100 (Schätzung des Gruppenschnitts)
}

export interface ChallengeResponsePayload {
  passed: boolean
  timeMs: number
  detail: string
  answer?: string
  progress?: number
}

export interface LogicWaveConfig {
  choices: string[]
  correctIndex: number
  explanation: string
}

export interface ScrambleWaveConfig {
  mode: 'word' | 'numbers'
  solutionWord?: string
  scrambledLetters?: string[]
  hint?: string
  targetSum?: number
  tiles?: number[]
  solutionIndices?: number[]
}

export interface WaveReaction {
  memberId: string
  memberName: string
  emoji: string
}
