'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Wave, Member, WaveResponse } from '@/lib/types'

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

  // New wave form
  const [newPrompt, setNewPrompt] = useState('')
  const [newType, setNewType] = useState<'text' | 'choice'>('text')
  const [newOptions, setNewOptions] = useState('')

  const fetchData = useCallback(async () => {
    const [wavesRes, membersRes] = await Promise.all([
      supabase.from('waves').select('*').order('number', { ascending: false }),
      supabase.from('members').select('*'),
    ])
    const waveList = (wavesRes.data || []) as Wave[]

    // Get response counts
    const wavesWithCounts: WaveWithResponses[] = await Promise.all(
      waveList.map(async (w) => {
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

  const handleCreateWave = async () => {
    if (!newPrompt.trim()) return
    setLoading(true)

    const nextNumber = waves.length > 0 ? Math.max(...waves.map(w => w.number)) + 1 : 1
    const options = newType === 'choice'
      ? newOptions.split('\n').map(o => o.trim()).filter(Boolean)
      : null

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

  const startReveal = async (wave: WaveWithResponses) => {
    await updateWaveStatus(wave.id, 'reveal', { revealed_at: new Date().toISOString() })
  }

  const startCooldown = async (wave: WaveWithResponses) => {
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await updateWaveStatus(wave.id, 'cooldown', { next_wave_at: next })
  }

  const endCooldownNow = async (wave: WaveWithResponses) => {
    // Set next_wave_at to past so it ends immediately
    await updateWaveStatus(wave.id, 'cooldown', { next_wave_at: new Date(Date.now() - 1000).toISOString() })
  }

  const activateWave = async (wave: WaveWithResponses) => {
    await updateWaveStatus(wave.id, 'active')
  }

  const deleteWave = async (waveId: string) => {
    if (!confirm('Welle löschen?')) return
    await supabase.from('waves').delete().eq('id', waveId)
    await fetchData()
  }

  const deleteMember = async (memberId: string) => {
    await supabase.from('members').delete().eq('id', memberId)
    await fetchData()
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: '#0a0a0a' }}>
        <div className="font-display text-4xl mb-12" style={{ color: '#c8a065' }}>∿ Admin</div>
        <div className="w-full max-w-xs flex flex-col gap-6">
          <input
            autoFocus
            type="password"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="border-b py-3 text-lg bg-transparent focus:outline-none"
            style={{ borderColor: '#1e1e1e', color: '#e8e4de', caretColor: '#c8a065' }}
            placeholder="Admin-Code"
          />
          {codeError && <p className="text-xs" style={{ color: '#c8a065' }}>{codeError}</p>}
          <button
            onClick={handleLogin}
            className="text-sm tracking-[0.2em] uppercase py-3 hover:opacity-70 transition-opacity"
            style={{ color: '#c8a065' }}
          >
            Einloggen →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 py-12 max-w-2xl mx-auto" style={{ background: '#0a0a0a', color: '#e8e4de' }}>
      <div className="flex items-center gap-4 mb-12">
        <span className="font-display text-3xl" style={{ color: '#c8a065' }}>∿</span>
        <h1 className="text-lg tracking-[0.2em] uppercase" style={{ color: '#6b6560' }}>Welle Admin</h1>
      </div>

      {/* Members */}
      <section className="mb-12">
        <h2 className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#6b6560' }}>
          Mitglieder ({members.length})
        </h2>
        <div className="flex flex-col gap-2">
          {members.map(m => (
            <div
              key={m.id}
              className="flex items-center justify-between py-3 px-4 border"
              style={{ borderColor: '#1e1e1e', background: '#0d0d0d', borderRadius: 2 }}
            >
              <span className="text-sm">{m.name}</span>
              <button
                onClick={() => deleteMember(m.id)}
                className="text-xs hover:opacity-70"
                style={{ color: '#6b6560' }}
              >
                entfernen
              </button>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-sm" style={{ color: '#3a3a3a' }}>Noch niemand beigetreten.</p>
          )}
        </div>
      </section>

      {/* Create Wave */}
      <section className="mb-12">
        <h2 className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#6b6560' }}>
          Neue Welle
        </h2>
        <div className="flex flex-col gap-4 p-5 border" style={{ borderColor: '#1e1e1e', background: '#0d0d0d', borderRadius: 2 }}>
          <div className="flex gap-3">
            {(['text', 'choice'] as const).map(t => (
              <button
                key={t}
                onClick={() => setNewType(t)}
                className="px-4 py-2 text-xs tracking-widest uppercase border transition-all"
                style={{
                  borderColor: newType === t ? '#c8a065' : '#1e1e1e',
                  color: newType === t ? '#c8a065' : '#6b6560',
                  background: newType === t ? 'rgba(200,160,101,0.08)' : 'transparent',
                  borderRadius: 2,
                }}
              >
                {t === 'text' ? 'Text' : 'Auswahl'}
              </button>
            ))}
          </div>

          <textarea
            value={newPrompt}
            onChange={e => setNewPrompt(e.target.value)}
            rows={3}
            className="bg-transparent border-b py-2 resize-none focus:outline-none text-sm"
            style={{ borderColor: '#1e1e1e', caretColor: '#c8a065' }}
            placeholder="Frage / Prompt..."
          />

          {newType === 'choice' && (
            <textarea
              value={newOptions}
              onChange={e => setNewOptions(e.target.value)}
              rows={3}
              className="bg-transparent border-b py-2 resize-none focus:outline-none text-sm"
              style={{ borderColor: '#1e1e1e', caretColor: '#c8a065' }}
              placeholder="Optionen (eine pro Zeile)"
            />
          )}

          <button
            onClick={handleCreateWave}
            disabled={loading || !newPrompt.trim()}
            className="self-start text-sm tracking-[0.2em] uppercase py-2 hover:opacity-70 transition-opacity disabled:opacity-30"
            style={{ color: '#c8a065' }}
          >
            {loading ? '···' : 'Erstellen →'}
          </button>
        </div>
      </section>

      {/* Waves */}
      <section>
        <h2 className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#6b6560' }}>
          Wellen
        </h2>
        <div className="flex flex-col gap-4">
          {waves.map(w => (
            <div
              key={w.id}
              className="p-5 border"
              style={{ borderColor: '#1e1e1e', background: '#0d0d0d', borderRadius: 2 }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-xs tracking-[0.2em] uppercase mr-3" style={{ color: '#6b6560' }}>
                    #{w.number}
                  </span>
                  <span
                    className="text-xs tracking-widest uppercase px-2 py-0.5 border"
                    style={{
                      borderColor: w.status === 'active' ? '#c8a065' : '#1e1e1e',
                      color: w.status === 'active' ? '#c8a065' : '#6b6560',
                      borderRadius: 1,
                    }}
                  >
                    {w.status}
                  </span>
                </div>
                <span className="text-xs" style={{ color: '#6b6560' }}>
                  {w.responseCount}/{members.length} Antworten
                </span>
              </div>

              <p className="text-sm mb-4 leading-relaxed" style={{ color: '#e8e4de' }}>
                {w.prompt}
              </p>

              <div className="flex gap-4 flex-wrap">
                {w.status === 'active' && (
                  <button
                    onClick={() => startReveal(w)}
                    disabled={loading}
                    className="text-xs tracking-[0.2em] uppercase hover:opacity-70 transition-opacity disabled:opacity-30"
                    style={{ color: '#c8a065' }}
                  >
                    Enthüllen →
                  </button>
                )}
                {w.status === 'reveal' && (
                  <button
                    onClick={() => startCooldown(w)}
                    disabled={loading}
                    className="text-xs tracking-[0.2em] uppercase hover:opacity-70 transition-opacity disabled:opacity-30"
                    style={{ color: '#c8a065' }}
                  >
                    Cooldown starten →
                  </button>
                )}
                {w.status === 'cooldown' && (
                  <>
                    <button
                      onClick={() => endCooldownNow(w)}
                      disabled={loading}
                      className="text-xs tracking-[0.2em] uppercase hover:opacity-70 transition-opacity disabled:opacity-30"
                      style={{ color: '#c8a065' }}
                    >
                      Cooldown sofort beenden ⚡
                    </button>
                    <button
                      onClick={() => activateWave(w)}
                      disabled={loading}
                      className="text-xs tracking-[0.2em] uppercase hover:opacity-70 transition-opacity disabled:opacity-30"
                      style={{ color: '#c8a065' }}
                    >
                      Wieder aktiv schalten ↺
                    </button>
                  </>
                )}
                <button
                  onClick={() => deleteWave(w.id)}
                  className="text-xs tracking-[0.2em] uppercase hover:opacity-70 transition-opacity"
                  style={{ color: '#6b6560' }}
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
          {waves.length === 0 && (
            <p className="text-sm" style={{ color: '#3a3a3a' }}>Noch keine Wellen.</p>
          )}
        </div>
      </section>
    </div>
  )
}
