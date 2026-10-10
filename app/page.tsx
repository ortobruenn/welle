'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Member, Wave, WaveResponse } from '@/lib/types'
import MysteryScreen from '@/components/MysteryScreen'
import JoinScreen from '@/components/JoinScreen'
import WaveScreen from '@/components/WaveScreen'
import WaitingScreen from '@/components/WaitingScreen'
import RevealScreen from '@/components/RevealScreen'
import CooldownScreen from '@/components/CooldownScreen'

type AppState = 'loading' | 'mystery' | 'join' | 'wave' | 'waiting' | 'reveal' | 'cooldown'

const TOTAL_MEMBERS = Number(process.env.NEXT_PUBLIC_TOTAL_MEMBERS) || 4

export default function Home() {
  const [appState, setAppState] = useState<AppState>('loading')
  const [member, setMember] = useState<Member | null>(null)
  const [wave, setWave] = useState<Wave | null>(null)
  const [responses, setResponses] = useState<WaveResponse[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [userResponse, setUserResponse] = useState<WaveResponse | null>(null)

  const loadAppState = useCallback(async (memberId: string) => {
    // Fetch latest wave
    const { data: waves } = await supabase
      .from('waves')
      .select('*')
      .order('number', { ascending: false })
      .limit(1)

    if (!waves || waves.length === 0) {
      setAppState('cooldown')
      return
    }

    const currentWave = waves[0] as Wave
    setWave(currentWave)

    // Fetch responses with member info
    const { data: waveResponses } = await supabase
      .from('responses')
      .select('*, members(*)')
      .eq('wave_id', currentWave.id)

    const responseList = (waveResponses || []) as WaveResponse[]
    setResponses(responseList)

    // Determine state & Auto-Transitions
    if (currentWave.status === 'active') {
      if (responseList.length >= TOTAL_MEMBERS) {
        // Alle haben geantwortet -> Auto-Reveal starten!
        await supabase
          .from('waves')
          .update({ status: 'reveal', revealed_at: new Date().toISOString() })
          .eq('id', currentWave.id)
        setAppState('reveal')
      } else {
        setAppState(myResponse ? 'waiting' : 'wave')
      }
    } else if (currentWave.status === 'reveal') {
      setAppState('reveal')
    } else if (currentWave.status === 'cooldown') {
      // Wenn der Cooldown abgelaufen ist -> Automatisch nächste Welle per Gemini generieren!
      if (currentWave.next_wave_at && new Date(currentWave.next_wave_at).getTime() <= Date.now()) {
        try {
          await fetch('/api/generate-wave', { method: 'POST' })
          // Danach frisch laden
          const { data: updatedWaves } = await supabase
            .from('waves')
            .select('*')
            .order('number', { ascending: false })
            .limit(1)
          if (updatedWaves && updatedWaves.length > 0) {
            setWave(updatedWaves[0] as Wave)
            setAppState('wave')
            return
          }
        } catch (e) {
          console.error('Auto next wave error:', e)
        }
      }
      setAppState('cooldown')
    }
  }, [])

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase.from('members').select('*')
    setMembers(data || [])
  }, [])

  useEffect(() => {
    // Check existing session
    const storedId = localStorage.getItem('welle_member_id')
    const storedName = localStorage.getItem('welle_member_name')

    if (storedId && storedName) {
      const memberData: Member = { id: storedId, name: storedName, created_at: '' }
      setMember(memberData)
      fetchMembers()
      loadAppState(storedId)
    } else {
      setTimeout(() => setAppState('mystery'), 400)
    }
  }, [loadAppState, fetchMembers])

  // Real-time subscriptions
  useEffect(() => {
    if (!member) return

    const channel = supabase
      .channel('welle-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'responses' },
        () => {
          fetchMembers()
          loadAppState(member.id)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waves' },
        () => loadAppState(member.id)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        () => fetchMembers()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [member, loadAppState, fetchMembers])

  const handleJoin = async (name: string) => {
    const memberId = crypto.randomUUID()
    await supabase.from('members').insert({ id: memberId, name })
    localStorage.setItem('welle_member_id', memberId)
    localStorage.setItem('welle_member_name', name)
    const memberData: Member = { id: memberId, name, created_at: new Date().toISOString() }
    setMember(memberData)
    await fetchMembers()
    await loadAppState(memberId)
  }

  const handleSubmit = async (content: string) => {
    if (!member || !wave) return
    await supabase.from('responses').insert({
      wave_id: wave.id,
      member_id: member.id,
      content,
    })
    await loadAppState(member.id)
  }

  // Loading state
  if (appState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="w-2 h-2 rounded-full animate-breathe" style={{ background: '#c8a065' }} />
      </div>
    )
  }

  if (appState === 'mystery') return <MysteryScreen onComplete={() => setAppState('join')} />
  if (appState === 'join') return <JoinScreen onJoin={handleJoin} />

  if (appState === 'wave' && wave) {
    return <WaveScreen wave={wave} member={member!} onSubmit={handleSubmit} />
  }

  if (appState === 'waiting' && wave) {
    return (
      <WaitingScreen
        wave={wave}
        responses={responses}
        members={members}
        totalMembers={TOTAL_MEMBERS}
        userResponse={userResponse}
      />
    )
  }

  if (appState === 'reveal' && wave) {
    return (
      <RevealScreen
        wave={wave}
        responses={responses}
        members={members}
        onComplete={async () => {
          const nextWaveDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          await supabase
            .from('waves')
            .update({ status: 'cooldown', next_wave_at: nextWaveDate })
            .eq('id', wave.id)
          setAppState('cooldown')
        }}
      />
    )
  }

  if (appState === 'cooldown') {
    return (
      <CooldownScreen
        wave={wave!}
        onWaveReady={() => member && loadAppState(member.id)}
      />
    )
  }

  return null
}
