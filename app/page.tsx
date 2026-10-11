'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Member, Wave, WaveResponse } from '@/lib/types'
import MysteryScreen from '@/components/MysteryScreen'
import JoinScreen from '@/components/JoinScreen'
import WaveScreen from '@/components/WaveScreen'
import WaitingScreen from '@/components/WaitingScreen'
import RevealScreen from '@/components/RevealScreen'
import CooldownScreen from '@/components/CooldownScreen'
import PushNotificationPrompt from '@/components/PushNotificationPrompt'
import { subscribeToPush } from '@/lib/pushClient'

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
  const isGeneratingWaveRef = useRef(false)

  const loadAppState = useCallback(async (memberId: string) => {
    // Fetch latest wave
    const { data: waves } = await supabase
      .from('waves')
      .select('*')
      .order('number', { ascending: false })
      .limit(1)

    if (!waves || waves.length === 0) {
      if (!isGeneratingWaveRef.current) {
        isGeneratingWaveRef.current = true
        try {
          await fetch('/api/generate-wave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: true }),
          })
          await loadAppState(memberId)
          return
        } catch (e) {
          console.error('Error generating initial wave:', e)
        } finally {
          isGeneratingWaveRef.current = false
        }
      }
      setWave(null)
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
        // Alle haben geantwortet -> Welle geht atomar in den Reveal-Status!
        const { data: updated } = await supabase
          .from('waves')
          .update({ status: 'reveal', revealed_at: new Date().toISOString() })
          .eq('id', currentWave.id)
          .eq('status', 'active')
          .select()

        // Nur der eine Client, der den Übergang von 'active' auf 'reveal' vollzogen hat, stößt das Echo an!
        if (updated && updated.length > 0) {
          fetch('/api/synthesize-echo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ waveId: currentWave.id }),
          }).catch(err => console.warn('Echo synthesis error:', err))
        }

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

          // Nächste Welle sofort im Hintergrund vorbereiten & serverseitig Auto-Trigger aktivieren!
          fetch('/api/generate-wave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prepareOnly: true, waveId: currentWave.id, nextWaveAt: nextWaveDate }),
          }).catch(err => console.warn('Pre-generation error:', err))
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
        // Wenn der gemeinsame Cooldown abgelaufen ist -> Sofort neue Welle aktivieren
        if (currentWave.next_wave_at && new Date(currentWave.next_wave_at).getTime() <= Date.now()) {
          if (!isGeneratingWaveRef.current) {
            isGeneratingWaveRef.current = true
            try {
              await fetch('/api/generate-wave', { method: 'POST' })
            } catch (e) {
              console.error('Auto next wave error:', e)
            } finally {
              isGeneratingWaveRef.current = false
            }
            // Gesamten Zustand für die neue Welle sauber neuladen
            await loadAppState(memberId)
            return
          }
        } else {
          // Während des Cooldowns im Hintergrund sicherstellen, dass die nächste Welle fertig vorbereitet ist
          fetch('/api/generate-wave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prepareOnly: true, waveId: currentWave.id, nextWaveAt: currentWave.next_wave_at }),
          }).catch(() => {})
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
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        if (params.has('reset')) {
          localStorage.removeItem('welle_member_id')
          localStorage.removeItem('welle_member_name')
          window.history.replaceState({}, '', window.location.pathname)
          setMember(null)
          setAppState('join')
          return
        }
      }

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
      setTimeout(() => setAppState('join'), 300)
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
        async () => {
          fetchMembers()
          if (member?.id) {
            const { data: stillThere } = await supabase
              .from('members')
              .select('id')
              .eq('id', member.id)
              .maybeSingle()
            if (!stillThere) {
              localStorage.removeItem('welle_member_id')
              localStorage.removeItem('welle_member_name')
              setMember(null)
              setAppState('join')
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reveals_seen' },
        () => loadAppState(member.id)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [member, loadAppState, fetchMembers])

  const handleJoin = async (name: string, enablePush?: boolean) => {
    setAppState('loading')
    const memberId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'm_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36)

    try {
      await supabase.from('members').insert({ id: memberId, name })
    } catch (e) {
      console.warn('Member insert warning:', e)
    }

    localStorage.setItem('welle_member_id', memberId)
    localStorage.setItem('welle_member_name', name)
    const memberData: Member = { id: memberId, name, created_at: new Date().toISOString() }
    setMember(memberData)

    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    fetchMembers().catch(() => {})

    if (enablePush) {
      subscribeToPush(memberId).catch((err) => {
        console.warn('Push subscribe error during join:', err)
      })
    }

    try {
      await loadAppState(memberId)
    } catch (err) {
      console.error('Error loading app state after join:', err)
      setAppState('wave')
    }
  }

  const handleSubmit = async (content: string) => {
    if (!member || !wave) return
    const { error } = await supabase.from('responses').insert({
      wave_id: wave.id,
      member_id: member.id,
      content,
    })
    if (error) {
      console.error('Failed to insert response:', error)
      throw error
    }
    await loadAppState(member.id)
  }

  const renderScreen = () => {
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
      return <WaveScreen wave={wave} member={member!} members={members} onSubmit={handleSubmit} />
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
          currentMember={member}
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
          wave={wave}
          memberId={member?.id}
          onWaveReady={() => member && loadAppState(member.id)}
        />
      )
    }

    return null
  }

  return (
    <>
      {member && appState !== 'mystery' && appState !== 'join' && appState !== 'loading' && (
        <div className="fixed top-4 left-4 right-4 z-40 max-w-sm mx-auto pointer-events-auto">
          <PushNotificationPrompt memberId={member.id} />
        </div>
      )}
      {renderScreen()}
    </>
  )
}
