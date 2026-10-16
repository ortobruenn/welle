'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Member, Wave, WaveResponse } from '@/lib/types'
import JoinScreen from '@/components/JoinScreen'
import WaveScreen from '@/components/WaveScreen'
import WaitingScreen from '@/components/WaitingScreen'
import RevealScreen from '@/components/RevealScreen'
import CooldownScreen from '@/components/CooldownScreen'
import TopBar from '@/components/TopBar'
import PushNotificationPrompt from '@/components/PushNotificationPrompt'
import { subscribeToPush } from '@/lib/pushClient'

type AppState =
  | 'loading'
  | 'join'
  | 'wave'
  | 'waiting'
  | 'reveal'
  | 'waiting_cooldown'
  | 'cooldown'

const COOLDOWN_MS = 10 * 1000 // 10s Schnelldurchlauf für aktives Gruppenspiel (anpassbar)

export default function Home() {
  const [appState, setAppState] = useState<AppState>('loading')
  const [member, setMember] = useState<Member | null>(null)
  const [wave, setWave] = useState<Wave | null>(null)
  const [responses, setResponses] = useState<WaveResponse[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [userResponse, setUserResponse] = useState<WaveResponse | null>(null)
  const isGeneratingWaveRef = useRef(false)

  const loadAppState = useCallback(async (memberId: string) => {
    const [{ data: waves }, { data: allMembers }] = await Promise.all([
      supabase.from('waves').select('*').order('number', { ascending: false }).limit(1),
      supabase.from('members').select('*').order('created_at', { ascending: true }),
    ])

    const memberList = (allMembers || []) as Member[]
    setMembers(memberList)
    const targetMembersCount = Math.max(2, memberList.length)

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

    const { data: waveResponses } = await supabase
      .from('responses')
      .select('*, members(*)')
      .eq('wave_id', currentWave.id)
      .order('created_at', { ascending: true })

    const responseList = (waveResponses || []) as WaveResponse[]
    setResponses(responseList)

    const myResponse = responseList.find(r => r.member_id === memberId) || null
    setUserResponse(myResponse)

    if (currentWave.status === 'active') {
      if (responseList.length >= targetMembersCount) {
        const { data: updated } = await supabase
          .from('waves')
          .update({ status: 'reveal', revealed_at: new Date().toISOString() })
          .eq('id', currentWave.id)
          .eq('status', 'active')
          .select()

        if (updated && updated.length > 0) {
          fetch('/api/synthesize-echo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ waveId: currentWave.id }),
          }).catch(() => {})
        }

        setAppState('reveal')
      } else {
        setAppState(myResponse ? 'waiting' : 'wave')
      }
    } else if (currentWave.status === 'reveal') {
      const { data: seenRecords } = await supabase
        .from('reveals_seen')
        .select('member_id')
        .eq('wave_id', currentWave.id)

      const seenList = (seenRecords || []).map(r => r.member_id)
      const hasSeen = seenList.includes(memberId)

      if (!hasSeen) {
        setAppState('reveal')
      } else {
        // Sobald alle, die an dieser Welle teilgenommen haben, den Reveal gesehen haben -> Cooldown!
        const requiredSeen = Math.max(2, responseList.length)
        if (seenList.length >= requiredSeen) {
          const nextWaveDate = new Date(Date.now() + COOLDOWN_MS).toISOString()
          await supabase
            .from('waves')
            .update({ status: 'cooldown', next_wave_at: nextWaveDate })
            .eq('id', currentWave.id)
            .eq('status', 'reveal')

          setAppState('cooldown')

          fetch('/api/generate-wave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prepareOnly: true,
              waveId: currentWave.id,
              nextWaveAt: nextWaveDate,
            }),
          }).catch(() => {})
        } else {
          setAppState('waiting_cooldown')
        }
      }
    } else if (currentWave.status === 'cooldown') {
      const { data: seenRecords } = await supabase
        .from('reveals_seen')
        .select('member_id')
        .eq('wave_id', currentWave.id)
        .eq('member_id', memberId)

      if (!seenRecords || seenRecords.length === 0) {
        setAppState('reveal')
      } else {
        if (
          currentWave.next_wave_at &&
          new Date(currentWave.next_wave_at).getTime() <= Date.now()
        ) {
          if (!isGeneratingWaveRef.current) {
            isGeneratingWaveRef.current = true
            try {
              await fetch('/api/generate-wave', { method: 'POST' })
            } catch (e) {
              console.error('Auto next wave error:', e)
            } finally {
              isGeneratingWaveRef.current = false
            }
            await loadAppState(memberId)
            return
          }
        } else {
          fetch('/api/generate-wave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prepareOnly: true,
              waveId: currentWave.id,
              nextWaveAt: currentWave.next_wave_at,
            }),
          }).catch(() => {})
        }
        setAppState('cooldown')
      }
    }
  }, [])

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: true })
    setMembers(data || [])
  }, [])

  useEffect(() => {
    const initSession = async () => {
      await fetchMembers()

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
        const { data: existing } = await supabase
          .from('members')
          .select('id, name, created_at')
          .eq('id', storedId)
          .maybeSingle()

        if (existing) {
          setMember(existing as Member)
          await loadAppState(storedId)
          return
        } else {
          localStorage.removeItem('welle_member_id')
          localStorage.removeItem('welle_member_name')
        }
      }
      setAppState('join')
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
        () => loadAppState(member.id)
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
          await fetchMembers()
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
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reveals_seen' },
        () => loadAppState(member.id)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [member, loadAppState, fetchMembers])

  const handleJoin = async (
    name: string,
    enablePush?: boolean,
    existingMember?: Member
  ) => {
    setAppState('loading')
    let memberId = existingMember?.id

    if (!memberId) {
      memberId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'm_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36)

      try {
        await supabase.from('members').insert({ id: memberId, name })
      } catch (e) {
        console.warn('Member insert warning:', e)
      }
    }

    localStorage.setItem('welle_member_id', memberId)
    localStorage.setItem('welle_member_name', name)
    const memberData: Member = {
      id: memberId,
      name,
      created_at: existingMember?.created_at || new Date().toISOString(),
    }
    setMember(memberData)

    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (enablePush) {
      subscribeToPush(memberId).catch(() => {})
    }

    await loadAppState(memberId)
  }

  const handleSubmitResponse = async (content: string) => {
    if (!member || !wave) return
    const { error } = await supabase.from('responses').insert({
      wave_id: wave.id,
      member_id: member.id,
      content,
    })
    if (error) throw error
    await loadAppState(member.id)
  }

  if (appState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-display text-4xl animate-breathe" style={{ color: '#d4a359' }}>
          ∿
        </div>
      </div>
    )
  }

  if (appState === 'join') {
    return <JoinScreen members={members} onJoin={handleJoin} />
  }

  const targetMembersCount = Math.max(2, members.length)

  return (
    <div className="min-h-screen flex flex-col">
      {member && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-sm mx-auto pointer-events-auto">
          <PushNotificationPrompt memberId={member.id} />
        </div>
      )}

      <TopBar
        wave={wave}
        members={members}
        responses={responses}
        currentMember={member}
      />

      {appState === 'wave' && wave && member && (
        <WaveScreen
          wave={wave}
          member={member}
          members={members}
          onSubmit={handleSubmitResponse}
        />
      )}

      {appState === 'waiting' && wave && (
        <WaitingScreen
          wave={wave}
          responses={responses}
          members={members}
          totalMembers={targetMembersCount}
          userResponse={userResponse}
        />
      )}

      {appState === 'reveal' && wave && (
        <RevealScreen
          wave={wave}
          responses={responses}
          members={members}
          currentMember={member}
          onComplete={async () => {
            if (!member) return
            await supabase
              .from('reveals_seen')
              .upsert({ wave_id: wave.id, member_id: member.id })
            await loadAppState(member.id)
          }}
        />
      )}

      {appState === 'waiting_cooldown' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-6 max-w-md mx-auto">
          <div className="font-display text-5xl font-light animate-breathe" style={{ color: '#d4a359' }}>
            ∿
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-light" style={{ color: '#f2efe9' }}>
              Bereit für die nächste Welle
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: '#7c766e' }}>
              Sobald auch die anderen die Enthüllung abgeschlossen haben, startet automatisch der nächste Zyklus.
            </p>
          </div>
        </div>
      )}

      {appState === 'cooldown' && (
        <CooldownScreen
          wave={wave}
          memberId={member?.id}
          onWaveReady={() => member && loadAppState(member.id)}
        />
      )}
    </div>
  )
}
