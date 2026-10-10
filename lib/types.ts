export interface Member {
  id: string
  name: string
  created_at: string
}

export type WavePromptType = 
  | 'text' 
  | 'choice' 
  | 'draw' 
  | 'photo' 
  | 'pulse' 
  | 'silence' 
  | 'chain' 
  | 'guess'

export interface Wave {
  id: string
  number: number
  prompt: string
  prompt_type: WavePromptType
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
  content: string // Text, Bild-DataURL, Touch-Metadaten oder Wahl
  created_at: string
  members?: Member
}
