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
import WaveVisualizer from '@/components/WaveVisualizer'
import { subscribeToPush } from '@/lib/pushClient'

type AppState =
  | 'loading'
  | 'join'
  | 'lobby'
  | 'wave'
  | 'waiting'
  | 'reveal'
  | 'waiting_cooldown'
  | 'cooldown'

const COOLDOWN_MS = 10 * 1000 // 10s Schnelldurchlauf für aktives Gruppenspiel (anpassbar)
const EXPECTED_MEMBERS = parseInt(process.env.NEXT_PUBLIC_TOTAL_MEMBERS || '4', 10) || 4

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
    const targetMembersCount = Math.max(EXPECTED_MEMBERS, memberList.length)

    if (!waves || waves.length === 0) {
      // Wenn die Gruppe noch nicht vollzählig ist: Warteraum anzeigen!
      if (memberList.length < EXPECTED_MEMBERS) {
        setWave(null)
        setAppState('lobby')
        return
      }

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
      setAppState('loading')
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

  const handleStartWaveEarly = async () => {
    if (isGeneratingWaveRef.current) return
    isGeneratingWaveRef.current = true
    try {
      await fetch('/api/generate-wave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      if (member) await loadAppState(member.id)
    } finally {
      isGeneratingWaveRef.current = false
    }
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

  const targetMembersCount = Math.max(EXPECTED_MEMBERS, members.length)

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

      {appState === 'lobby' && (
        <div className="flex-1 flex flex-col items-center justify-between px-5 pb-10 pt-4 max-w-md mx-auto w-full">
          <div className="w-full space-y-2">
            <WaveVisualizer variant="amber" intensity={0.8} height={56} />
            <p className="text-center text-[11px] uppercase tracking-[0.25em]" style={{ color: '#d4a359' }}>
              Warteraum · {members.length} von {EXPECTED_MEMBERS} Freunden bereit
            </p>
          </div>

          <div className="my-auto py-8 w-full space-y-8 text-center animate-fade-up">
            <div className="space-y-3 px-3">
              <span className="text-xs uppercase tracking-[0.2em]" style={{ color: '#d4a359' }}>
                Welle #1 steht bereit
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-light leading-snug" style={{ color: '#f2efe9' }}>
                Der Kreis formiert sich
              </h2>
              <p className="text-xs leading-relaxed max-w-xs mx-auto" style={{ color: '#9c958c' }}>
                Sobald alle {EXPECTED_MEMBERS} Freunde beigetreten sind, startet Welle #1 automatisch synchron für die gesamte Gruppe!
              </p>
            </div>

            {/* Member Orbs / Slots */}
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto w-full">
              {Array.from({ length: Math.max(EXPECTED_MEMBERS, members.length) }).map((_, idx) => {
                const joined = members[idx]
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl flex flex-col items-center gap-2 transition-all duration-500"
                    style={{
                      background: joined ? 'rgba(212, 163, 89, 0.12)' : 'rgba(255,255,255,0.02)',
                      border: joined
                        ? '1px solid rgba(212, 163, 89, 0.45)'
                        : '1px dashed rgba(255,255,255,0.1)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                      style={{
                        background: joined ? '#d4a359' : 'rgba(255,255,255,0.04)',
                        color: joined ? '#070709' : '#5c564e',
                        boxShadow: joined ? '0 0 16px rgba(212, 163, 89, 0.35)' : 'none',
                      }}
                    >
                      {joined ? joined.name.slice(0, 1).toUpperCase() : `${idx + 1}`}
                    </div>
                    <p className="text-xs font-medium truncate max-w-[100px]" style={{ color: joined ? '#f2efe9' : '#5c564e' }}>
                      {joined ? joined.name : 'Offener Platz...'}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Early Start Button */}
            <div className="pt-2 space-y-3">
              {members.length >= 2 && (
                <button
                  onClick={handleStartWaveEarly}
                  className="px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-semibold border border-[#d4a359]/40 text-[#d4a359] hover:bg-[#d4a359]/10 cursor-pointer transition-all"
                >
                  Schon jetzt mit {members.length} Spielern starten →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
