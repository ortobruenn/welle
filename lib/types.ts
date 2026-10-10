export interface Member {
  id: string
  name: string
  created_at: string
}

export interface Wave {
  id: string
  number: number
  prompt: string
  prompt_type: 'text' | 'choice'
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
  content: string
  created_at: string
  members?: Member
}
