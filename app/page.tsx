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

type AppState = 'loading' | 'mystery' | 'join' | 'wave' | 'waiting' | 'reveal' | 'waiting_cooldown' | 'cooldown'

// TEST-MODUS: 2 Personen, Cooldown 10 Sekunden (stellen wir später zurück auf 4 und 24h)
const TOTAL_MEMBERS = 2
const COOLDOWN_MS = 10 * 1000

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

    const myResponse = responseList.find(r => r.member_id === memberId) || null
    setUserResponse(myResponse)

    // Determine state & Auto-Transitions
    if (currentWave.status === 'active') {
      if (responseList.length >= TOTAL_MEMBERS) {
        // Alle 4 haben geantwortet -> Welle geht in den Reveal-Status!
        await supabase
          .from('waves')
          .update({ status: 'reveal', revealed_at: new Date().toISOString() })
          .eq('id', currentWave.id)
        setAppState('reveal')
      } else {
        setAppState(myResponse ? 'waiting' : 'wave')
      }
    } else if (currentWave.status === 'reveal') {
      // Prüfen, ob DIESER Nutzer den Reveal schon gesehen und bestätigt hat
      const { data: seenRecords } = await supabase
        .from('reveals_seen')
        .select('member_id')
        .eq('wave_id', currentWave.id)

      const seenList = (seenRecords || []).map(r => r.member_id)
      const hasSeen = seenList.includes(memberId)

      if (!hasSeen) {
        // Nutzer hat es noch nicht gesehen -> Reveal anzeigen!
        setAppState('reveal')
      } else {
        // Dieser Nutzer hat es gesehen, aber warten noch andere?
        if (seenList.length >= TOTAL_MEMBERS) {
          // Beide haben es gesehen! Cooldown synchron starten (10 Sekunden)
          const nextWaveDate = new Date(Date.now() + COOLDOWN_MS).toISOString()
          await supabase
            .from('waves')
            .update({ status: 'cooldown', next_wave_at: nextWaveDate })
            .eq('id', currentWave.id)
          setAppState('cooldown')
        } else {
          // Dieser Nutzer wartet, bis die anderen es auch gelesen haben
          setAppState('waiting_cooldown')
        }
      }
    } else if (currentWave.status === 'cooldown') {
      // Prüfen, ob der Nutzer vor dem Cooldown den Reveal überhaupt je gesehen hat
      const { data: seenRecords } = await supabase
        .from('reveals_seen')
        .select('member_id')
        .eq('wave_id', currentWave.id)
        .eq('member_id', memberId)

      if (!seenRecords || seenRecords.length === 0) {
        // Hat es verpasst während offline -> ZUERST Enthüllung nachholen!
        setAppState('reveal')
      } else {
        // Wenn der gemeinsame Cooldown abgelaufen ist -> Automatisch nächste Welle per Gemini
        if (currentWave.next_wave_at && new Date(currentWave.next_wave_at).getTime() <= Date.now()) {
          try {
            await fetch('/api/generate-wave', { method: 'POST' })
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
    }
  }, [])

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase.from('members').select('*')
    setMembers(data || [])
  }, [])

  useEffect(() => {
    // Check existing session
    const initSession = async () => {
      const storedId = localStorage.getItem('welle_member_id')
      const storedName = localStorage.getItem('welle_member_name')

      if (storedId && storedName) {
        // Prüfen, ob der Nutzer in der Datenbank noch existiert (oder im Admin gelöscht wurde)
        const { data: existing } = await supabase
          .from('members')
          .select('id, name')
          .eq('id', storedId)
          .maybeSingle()

        if (existing) {
          const memberData: Member = { id: storedId, name: storedName, created_at: '' }
          setMember(memberData)
          fetchMembers()
          loadAppState(storedId)
          return
        } else {
          // Nutzer wurde gelöscht -> Session aufräumen
          localStorage.removeItem('welle_member_id')
          localStorage.removeItem('welle_member_name')
        }
      }
      setTimeout(() => setAppState('mystery'), 400)
    }

    initSession()
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reveals_seen' },
        () => loadAppState(member.id)
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
          if (!member) return
          // Speichere, dass dieser Nutzer den Reveal gesehen hat
          await supabase
            .from('reveals_seen')
            .upsert({ wave_id: wave.id, member_id: member.id })

          await loadAppState(member.id)
        }}
      />
    )
  }

  if (appState === 'waiting_cooldown') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: '#0a0a0a' }}>
        <div className="font-display text-5xl font-light mb-8 animate-breathe" style={{ color: '#c8a065' }}>∿</div>
        <p className="text-sm tracking-[0.2em] uppercase text-center mb-3" style={{ color: '#e8e4de' }}>
          Du hast die Welle gesehen
        </p>
        <p className="text-xs tracking-[0.25em] uppercase text-center" style={{ color: '#6b6560' }}>
          Die Ruhephase beginnt, sobald alle die Antworten gelesen haben
        </p>
      </div>
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
