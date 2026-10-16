'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Wave, Member, CoreWaveType } from '@/lib/types'
import { extractEcho, extractUndercover, attachUndercoverToOptions } from '@/lib/mystery'

const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || 'admin'

interface WaveWithResponses extends Wave {
  responseCount?: number
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [waves, setWaves] = useState<WaveWithResponses[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)

  const [newPrompt, setNewPrompt] = useState('')
  const [newType, setNewType] = useState<CoreWaveType>('text')
  const [newOptions, setNewOptions] = useState('')
  const [pushStatus, setPushStatus] = useState('')

  const sendTestPush = async () => {
    setPushStatus('Sende...')
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setPushStatus(`✓ Gesendet (${data.sent} Empfänger)`)
      } else {
        setPushStatus(`Fehler: ${data.error}`)
      }
    } catch (err: any) {
      setPushStatus(`Fehler: ${err.message}`)
    }
    setTimeout(() => setPushStatus(''), 5000)
  }

  const fetchData = useCallback(async () => {
    const [wavesRes, membersRes] = await Promise.all([
      supabase.from('waves').select('*').order('number', { ascending: false }),
      supabase.from('members').select('*').order('created_at', { ascending: true }),
    ])
    const waveList = (wavesRes.data || []) as Wave[]

    const wavesWithCounts: WaveWithResponses[] = await Promise.all(
      waveList.map(async w => {
        const { count } = await supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('wave_id', w.id)
        return { ...w, responseCount: count || 0 }
      })
    )

    setWaves(wavesWithCounts)
    setMembers(membersRes.data || [])
  }, [])

  useEffect(() => {
    if (authed) fetchData()
  }, [authed, fetchData])

  const handleLogin = () => {
    if (code.trim().toLowerCase() === ADMIN_CODE.toLowerCase()) {
      setAuthed(true)
    } else {
      setCodeError('Falscher Code.')
    }
  }

  const handleGenerateWithAI = async (forcedFormat?: CoreWaveType) => {
    setLoading(true)
    try {
      await fetch('/api/generate-wave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, forcedFormat }),
      })
      await fetchData()
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleCreateWave = async () => {
    if (!newPrompt.trim()) return
    setLoading(true)

    const nextNumber = waves.length > 0 ? Math.max(...waves.map(w => w.number)) + 1 : 1
    let options: string[] | null = null

    if (newType === 'spectrum') {
      const parsed = newOptions
        .split('\n')
        .map(o => o.trim())
        .filter(Boolean)
      options = parsed.length >= 2 ? parsed.slice(0, 2) : ['0% Minimal-Modus', '100% Maximal-Ausschlag']
    } else if (newType === 'undercover' && members.length >= 2) {
      const target = members[Math.floor(Math.random() * members.length)]
      options = attachUndercoverToOptions(
        null,
        target.id,
        target.name,
        newOptions.trim() ||
          'Schmuggle eine charmante Notlüge oder das genaue Gegenteil deiner echten Meinung ein – ohne aufzufliegen!'
      )
    }

    await supabase.from('waves').insert({
      number: nextNumber,
      prompt: newPrompt.trim(),
      prompt_type: newType,
      options,
      status: 'active',
    })

    setNewPrompt('')
    setNewOptions('')
    setNewType('text')
    await fetchData()
    setLoading(false)
  }

  const updateWaveStatus = async (waveId: string, status: Wave['status'], extra?: Partial<Wave>) => {
    setLoading(true)
    await supabase.from('waves').update({ status, ...extra }).eq('id', waveId)
    await fetchData()
    setLoading(false)
  }

  const deleteWave = async (waveId: string) => {
    if (!confirm('Welle löschen?')) return
    setLoading(true)
    try {
      await supabase.from('responses').delete().eq('wave_id', waveId)
      await supabase.from('reveals_seen').delete().eq('wave_id', waveId)
      await supabase.from('waves').delete().eq('id', waveId)
      await fetchData()
    } finally {
      setLoading(false)
    }
  }

  const deleteAllWaves = async () => {
    if (!confirm(`Möchtest du wirklich ALLE ${waves.length} Wellen löschen?`)) return
    setLoading(true)
    try {
      await supabase.from('responses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('reveals_seen').delete().neq('wave_id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('waves').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await fetchData()
    } finally {
      setLoading(false)
    }
  }

  const deleteMember = async (memberId: string) => {
    setLoading(true)
    try {
      await supabase.from('push_subscriptions').delete().eq('member_id', memberId)
      await supabase.from('responses').delete().eq('member_id', memberId)
      await supabase.from('reveals_seen').delete().eq('member_id', memberId)
      await supabase.from('members').delete().eq('id', memberId)
      await fetchData()
    } finally {
      setLoading(false)
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8">
        <div className="font-display text-4xl mb-10" style={{ color: '#d4a359' }}>
          ∿ Welle Admin
        </div>
        <div className="w-full max-w-xs flex flex-col gap-5">
          <input
            autoFocus
            type="password"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="px-4 py-3.5 rounded-xl text-base bg-white/5 border border-white/10 focus:outline-none"
            style={{ color: '#f2efe9' }}
            placeholder="Admin-Code"
          />
          {codeError && (
            <p className="text-xs text-center" style={{ color: '#e05a47' }}>
              {codeError}
            </p>
          )}
          <button
            onClick={handleLogin}
            className="py-3.5 rounded-xl text-xs tracking-[0.2em] uppercase font-semibold cursor-pointer"
            style={{ background: '#d4a359', color: '#070709' }}
          >
            Einloggen →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-3xl" style={{ color: '#d4a359' }}>
            ∿
          </span>
          <h1 className="text-sm tracking-[0.25em] uppercase font-medium" style={{ color: '#f2efe9' }}>
            Welle 2.0 · Regie & Admin
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {pushStatus && (
            <span className="text-xs" style={{ color: '#d4a359' }}>
              {pushStatus}
            </span>
          )}
          <button
            onClick={sendTestPush}
            className="text-xs tracking-[0.15em] uppercase px-3.5 py-2 rounded-xl border border-[#d4a359]/40 text-[#d4a359] cursor-pointer"
          >
            Test-Push 🔔
          </button>
        </div>
      </div>

      {/* 1-Klick KI-Launcher für alle 8 Formate */}
      <section className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs tracking-[0.22em] uppercase font-semibold" style={{ color: '#d4a359' }}>
            ⚡ Sofort-Welle starten (8 Formate)
          </h2>
          <button
            onClick={() => handleGenerateWithAI()}
            disabled={loading}
            className="text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
            style={{ background: '#d4a359', color: '#070709' }}
          >
            ✨ Auto-Rotation
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleGenerateWithAI('text')}
            disabled={loading}
            className="p-3.5 text-left rounded-xl border border-white/10 hover:border-[#d4a359] transition-all cursor-pointer bg-white/[0.02]"
          >
            <span className="block font-medium text-sm text-[#f2efe9] mb-0.5">🔒 Blind-Beichte</span>
            <span className="text-[11px] text-[#7c766e] block">Anonyme Antwort + Autoren-Raten</span>
          </button>

          <button
            onClick={() => handleGenerateWithAI('undercover')}
            disabled={loading}
            className="p-3.5 text-left rounded-xl border border-[#e05a47]/40 hover:border-[#e05a47] transition-all cursor-pointer bg-[#e05a47]/[0.05]"
          >
            <span className="block font-medium text-sm text-[#e05a47] mb-0.5">🕵️ Sabotage (Maulwurf)</span>
            <span className="text-[11px] text-[#9c958c] block">1 Geheim-Agent + Verhör-Voting</span>
          </button>

          <button
            onClick={() => handleGenerateWithAI('spectrum')}
            disabled={loading}
            className="p-3.5 text-left rounded-xl border border-white/10 hover:border-[#d4a359] transition-all cursor-pointer bg-white/[0.02]"
          >
            <span className="block font-medium text-sm text-[#f2efe9] mb-0.5">🎚️ Frequenz-Spektrum</span>
            <span className="text-[11px] text-[#7c766e] block">Eigener Puls + Gruppen-Radar Tipp</span>
          </button>

          <button
            onClick={() => handleGenerateWithAI('draw')}
            disabled={loading}
            className="p-3.5 text-left rounded-xl border border-white/10 hover:border-[#d4a359] transition-all cursor-pointer bg-white/[0.02]"
          >
            <span className="block font-medium text-sm text-[#f2efe9] mb-0.5">🎨 35s-Blindfunk</span>
            <span className="text-[11px] text-[#7c766e] block">35-Sekunden-Skizzensprint</span>
          </button>

          <button
            onClick={() => handleGenerateWithAI('photo')}
            disabled={loading}
            className="p-3.5 text-left rounded-xl border border-white/10 hover:border-[#d4a359] transition-all cursor-pointer bg-white/[0.02]"
          >
            <span className="block font-medium text-sm text-[#f2efe9] mb-0.5">📷 Live-Schnappschuss</span>
            <span className="text-[11px] text-[#7c766e] block">Direkter Rückkamera-Sucher (600x600)</span>
          </button>

          <button
            onClick={() => handleGenerateWithAI('memory')}
            disabled={loading}
            className="p-3.5 text-left rounded-xl border border-[#49b882]/40 hover:border-[#49b882] transition-all cursor-pointer bg-[#49b882]/[0.05]"
          >
            <span className="block font-medium text-sm text-[#49b882] mb-0.5">🧠 35s-Gedächtnis-Tresor</span>
            <span className="text-[11px] text-[#9c958c] block">4x4 Code merken · 35s Blind-Sprint</span>
          </button>

          <button
            onClick={() => handleGenerateWithAI('logic')}
            disabled={loading}
            className="p-3.5 text-left rounded-xl border border-[#49b882]/40 hover:border-[#49b882] transition-all cursor-pointer bg-[#49b882]/[0.05]"
          >
            <span className="block font-medium text-sm text-[#49b882] mb-0.5">🧩 35s-Logik-Falle</span>
            <span className="text-[11px] text-[#9c958c] block">35s Deduktions-Kopfnuss · 1 Versuch</span>
          </button>

          <button
            onClick={() => handleGenerateWithAI('scramble')}
            disabled={loading}
            className="p-3.5 text-left rounded-xl border border-[#49b882]/40 hover:border-[#49b882] transition-all cursor-pointer bg-[#49b882]/[0.05]"
          >
            <span className="block font-medium text-sm text-[#49b882] mb-0.5">⚡ 35s-Kniffel-Sprint</span>
            <span className="text-[11px] text-[#9c958c] block">Buchstabensalat & 3-Zahlen-Summe im Wechsel</span>
          </button>
        </div>
      </section>

      {/* Manuelle Erstellung */}
      <section className="glass-card rounded-2xl p-5 space-y-4">
        <h2 className="text-xs tracking-[0.22em] uppercase" style={{ color: '#7c766e' }}>
          Eigene Welle schreiben
        </h2>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { id: 'text', label: '🔒 Blind-Beichte' },
              { id: 'undercover', label: '🕵️ Sabotage' },
              { id: 'spectrum', label: '🎚️ Spektrum' },
              { id: 'draw', label: '🎨 35s-Skizze' },
              { id: 'photo', label: '📷 Live-Foto' },
              { id: 'memory', label: '🧠 35s-Tresor' },
              { id: 'logic', label: '🧩 Logik-Falle' },
              { id: 'scramble', label: '⚡ 35s-Kniffel' },
            ] as const
          ).map(t => (
            <button
              key={t.id}
              onClick={() => setNewType(t.id)}
              className="px-3 py-1.5 rounded-lg text-xs tracking-wider uppercase border transition-all cursor-pointer"
              style={{
                borderColor: newType === t.id ? '#d4a359' : 'rgba(255,255,255,0.08)',
                color: newType === t.id ? '#d4a359' : '#7c766e',
                background: newType === t.id ? 'rgba(212,163,89,0.1)' : 'transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          value={newPrompt}
          onChange={e => setNewPrompt(e.target.value)}
          rows={2}
          className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm focus:outline-none"
          placeholder="Frage / Impuls für die Gruppe..."
        />

        {(newType === 'spectrum' || newType === 'undercover') && (
          <textarea
            value={newOptions}
            onChange={e => setNewOptions(e.target.value)}
            rows={2}
            className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm focus:outline-none"
            placeholder={
              newType === 'spectrum'
                ? 'Pol 0% (Zeile 1)\nPol 100% (Zeile 2)'
                : 'Geheimer Sabotage-Auftrag für den Maulwurf...'
            }
          />
        )}

        <button
          onClick={handleCreateWave}
          disabled={loading || !newPrompt.trim()}
          className="px-5 py-2.5 rounded-xl text-xs uppercase tracking-[0.2em] font-semibold cursor-pointer disabled:opacity-30"
          style={{ background: '#d4a359', color: '#070709' }}
        >
          Manuelle Welle starten →
        </button>
      </section>

      {/* Mitglieder */}
      <section className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs tracking-[0.22em] uppercase" style={{ color: '#7c766e' }}>
            Freundeskreis ({members.length})
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {members.map(m => (
            <div
              key={m.id}
              className="flex items-center justify-between py-2.5 px-3.5 rounded-xl border border-white/10 bg-black/20"
            >
              <span className="text-sm font-medium">{m.name}</span>
              <button
                onClick={() => deleteMember(m.id)}
                className="text-xs text-red-400/80 hover:text-red-300 cursor-pointer"
              >
                entfernen
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Wellen-Liste */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs tracking-[0.22em] uppercase" style={{ color: '#7c766e' }}>
            Wellen-Historie ({waves.length})
          </h2>
          {waves.length > 0 && (
            <button
              onClick={deleteAllWaves}
              disabled={loading}
              className="text-xs uppercase tracking-wider text-red-400 hover:text-red-300 cursor-pointer"
            >
              Alle löschen ✕
            </button>
          )}
        </div>

        <div className="space-y-3">
          {waves.map(w => {
            const undercover = w.prompt_type === 'undercover' ? extractUndercover(w.options) : null
            const echo = extractEcho(w.options)
            return (
              <div key={w.id} className="glass-card rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#d4a359]">#{w.number}</span>
                    <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-[#9c958c]">
                      {w.prompt_type}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded border border-white/10">
                      {w.status}
                    </span>
                  </div>
                  <span className="text-xs text-[#7c766e]">
                    {w.responseCount}/{members.length} Antworten
                  </span>
                </div>

                <p className="text-sm font-medium text-[#f2efe9]">{w.prompt}</p>

                {undercover && (
                  <p className="text-xs text-[#e05a47]">
                    🕵️ Maulwurf ({undercover.memberName}): „{undercover.prompt}“
                  </p>
                )}
                {echo && <p className="text-xs italic text-[#9c958c]">∿ „{echo}“</p>}

                <div className="flex gap-4 pt-1 text-xs">
                  {w.status === 'active' && (
                    <button
                      onClick={() =>
                        updateWaveStatus(w.id, 'reveal', {
                          revealed_at: new Date().toISOString(),
                        })
                      }
                      className="text-[#d4a359] cursor-pointer"
                    >
                      Sofort enthüllen →
                    </button>
                  )}
                  <button
                    onClick={() => deleteWave(w.id)}
                    className="text-[#7c766e] hover:text-red-400 cursor-pointer"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
