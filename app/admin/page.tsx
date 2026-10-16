'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Wave, Member, CoreWaveType } from '@/lib/types'
import {
  extractEcho,
  extractUndercover,
  attachUndercoverToOptions,
  generateDynamicGlitchPrompt,
  generateDynamicSpectrumPoles,
} from '@/lib/mystery'
import {
  getAppConfig,
  saveAppConfig,
  formatCooldownDuration,
  MAX_COOLDOWN_SECONDS,
} from '@/lib/appConfig'

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

  // Countdown / Cooldown Konfiguration (bis max 24h)
  const [cooldownSeconds, setCooldownSeconds] = useState(10)
  const [customHours, setCustomHours] = useState(0)
  const [customMinutes, setCustomMinutes] = useState(0)
  const [customSeconds, setCustomSeconds] = useState(10)
  const [cooldownSaveStatus, setCooldownSaveStatus] = useState('')

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
    const [wavesRes, membersRes, config] = await Promise.all([
      supabase.from('waves').select('*').gt('number', 0).order('number', { ascending: false }),
      supabase.from('members').select('*').order('created_at', { ascending: true }),
      getAppConfig(),
    ])
    const waveList = (wavesRes.data || []) as Wave[]

    setCooldownSeconds(config.cooldownSeconds)
    setCustomHours(Math.floor(config.cooldownSeconds / 3600))
    setCustomMinutes(Math.floor((config.cooldownSeconds % 3600) / 60))
    setCustomSeconds(config.cooldownSeconds % 60)

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
      options =
        parsed.length >= 2
          ? parsed.slice(0, 2)
          : generateDynamicSpectrumPoles(newPrompt.trim(), Date.now())
    } else if (newType === 'undercover' && members.length >= 2) {
      const target = members[Math.floor(Math.random() * members.length)]
      options = attachUndercoverToOptions(
        null,
        target.id,
        target.name,
        newOptions.trim() ||
          generateDynamicGlitchPrompt(newPrompt.trim(), Date.now())
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

  const handleSaveCooldown = async (totalSec: number) => {
    const clamped = Math.min(Math.max(totalSec, 5), MAX_COOLDOWN_SECONDS)
    setCooldownSeconds(clamped)
    setCustomHours(Math.floor(clamped / 3600))
    setCustomMinutes(Math.floor((clamped % 3600) / 60))
    setCustomSeconds(clamped % 60)
    setCooldownSaveStatus('Speichere...')
    try {
      await saveAppConfig({ cooldownSeconds: clamped })
      setCooldownSaveStatus('✓ Gespeichert')
    } catch (e: any) {
      setCooldownSaveStatus('Fehler beim Speichern')
    }
    setTimeout(() => setCooldownSaveStatus(''), 3500)
  }

  const handleRestartCurrentCooldown = async (sec: number) => {
    const latestWave = waves[0]
    if (!latestWave || latestWave.status !== 'cooldown') return
    const nextDate = new Date(Date.now() + sec * 1000).toISOString()
    await updateWaveStatus(latestWave.id, 'cooldown', { next_wave_at: nextDate })
  }

  const handleEndCooldownNow = async () => {
    const latestWave = waves[0]
    if (!latestWave || latestWave.status !== 'cooldown') return
    await updateWaveStatus(latestWave.id, 'cooldown', { next_wave_at: new Date().toISOString() })
    fetch('/api/generate-wave', { method: 'POST' }).catch(() => {})
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

  const deleteAllMembers = async () => {
    if (!confirm(`Möchtest du wirklich ALLE ${members.length} Mitglieder löschen?`)) return
    setLoading(true)
    try {
      await supabase.from('push_subscriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('responses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('reveals_seen').delete().neq('wave_id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('members').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      localStorage.removeItem('welle_member_id')
      localStorage.removeItem('welle_member_name')
      await fetchData()
    } finally {
      setLoading(false)
    }
  }

  const handleFactoryReset = async () => {
    const input = prompt(
      'Achtung: Dies löscht ALLE Wellen, Antworten, Reaktionen, Push-Abos und Mitglieder!\n\nTippe "RESET" ein, um die App auf Werkseinstellungen für den Release zurückzusetzen:'
    )
    if (input !== 'RESET') return

    setLoading(true)
    try {
      await supabase.from('push_subscriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('responses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('reveals_seen').delete().neq('wave_id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('waves').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('members').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      localStorage.removeItem('welle_member_id')
      localStorage.removeItem('welle_member_name')
      await fetchData()
      alert('Die App wurde erfolgreich komplett zurückgesetzt! Die nächste Welle startet wieder bei #1.')
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

      {/* ⏱️ Countdown & Ruhephase-Konfiguration (bis max 24h) */}
      <section className="glass-card rounded-2xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xs tracking-[0.22em] uppercase font-semibold" style={{ color: '#d4a359' }}>
              ⏱️ Countdown / Ruhephase (Cooldown)
            </h2>
            <p className="text-[12px] text-[#9c958c] mt-0.5">
              Dauer der Pause zwischen zwei Wellen bis zum nächsten Impuls (max. 24h).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-3 py-1 rounded-full font-mono font-medium"
              style={{
                background: 'rgba(212, 163, 89, 0.12)',
                color: '#d4a359',
                border: '1px solid rgba(212, 163, 89, 0.3)',
              }}
            >
              Aktuell: {formatCooldownDuration(cooldownSeconds)}
            </span>
            {cooldownSaveStatus && (
              <span className="text-xs text-[#49b882] animate-fade-in font-medium">
                {cooldownSaveStatus}
              </span>
            )}
          </div>
        </div>

        {/* Schnell-Auswahl Presets */}
        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-wider text-[#7c766e] block">
            Schnell-Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '10s (Test)', sec: 10 },
              { label: '1 Min', sec: 60 },
              { label: '5 Min', sec: 300 },
              { label: '15 Min', sec: 900 },
              { label: '30 Min', sec: 1800 },
              { label: '1 Std', sec: 3600 },
              { label: '2 Std', sec: 7200 },
              { label: '4 Std', sec: 14400 },
              { label: '8 Std', sec: 28800 },
              { label: '12 Std', sec: 43200 },
              { label: '24 Std (Max)', sec: 86400 },
            ].map(preset => {
              const isActive = cooldownSeconds === preset.sec
              return (
                <button
                  key={preset.sec}
                  onClick={() => handleSaveCooldown(preset.sec)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider transition-all cursor-pointer"
                  style={{
                    border: isActive
                      ? '1px solid #d4a359'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    background: isActive
                      ? 'rgba(212, 163, 89, 0.15)'
                      : 'rgba(255, 255, 255, 0.02)',
                    color: isActive ? '#d4a359' : '#9c958c',
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Eigene Zeit in Stunden & Minuten eingeben */}
        <div className="space-y-2 pt-2 border-t border-white/5">
          <label className="text-[11px] uppercase tracking-wider text-[#7c766e] block">
            Benutzerdefinierte Zeit einstellen (max. 24h)
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 rounded-xl px-3 py-2">
              <input
                type="number"
                min={0}
                max={24}
                value={customHours}
                onChange={e => {
                  const val = Math.min(24, Math.max(0, parseInt(e.target.value, 10) || 0))
                  setCustomHours(val)
                }}
                className="w-12 bg-transparent text-center text-sm font-mono text-[#f2efe9] focus:outline-none"
              />
              <span className="text-xs text-[#7c766e]">Std</span>
            </div>

            <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 rounded-xl px-3 py-2">
              <input
                type="number"
                min={0}
                max={59}
                value={customMinutes}
                onChange={e => {
                  const val = Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0))
                  setCustomMinutes(val)
                }}
                className="w-12 bg-transparent text-center text-sm font-mono text-[#f2efe9] focus:outline-none"
              />
              <span className="text-xs text-[#7c766e]">Min</span>
            </div>

            {customHours === 0 && customMinutes === 0 && (
              <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 rounded-xl px-3 py-2">
                <input
                  type="number"
                  min={5}
                  max={59}
                  value={customSeconds}
                  onChange={e => {
                    const val = Math.min(59, Math.max(5, parseInt(e.target.value, 10) || 5))
                    setCustomSeconds(val)
                  }}
                  className="w-12 bg-transparent text-center text-sm font-mono text-[#f2efe9] focus:outline-none"
                />
                <span className="text-xs text-[#7c766e]">Sek</span>
              </div>
            )}

            <button
              onClick={() => {
                const totalSec =
                  customHours * 3600 +
                  customMinutes * 60 +
                  (customHours === 0 && customMinutes === 0 ? customSeconds : 0)
                handleSaveCooldown(totalSec)
              }}
              disabled={loading || (customHours === 0 && customMinutes === 0 && customSeconds < 5)}
              className="px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-semibold cursor-pointer disabled:opacity-40"
              style={{ background: '#d4a359', color: '#070709' }}
            >
              Zeit speichern →
            </button>
          </div>
        </div>

        {/* Live-Steuerung für aktuell laufende Welle */}
        {waves.length > 0 && waves[0].status === 'cooldown' && (
          <div
            className="p-4 rounded-xl border space-y-3"
            style={{
              background: 'rgba(212, 163, 89, 0.05)',
              borderColor: 'rgba(212, 163, 89, 0.25)',
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#d4a359] block font-semibold">
                  Aktuell: Welle #{waves[0].number} in Ruhephase
                </span>
                <span className="text-xs text-[#9c958c]">
                  Endet regulär:{' '}
                  {waves[0].next_wave_at
                    ? `${new Date(waves[0].next_wave_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })} Uhr`
                    : 'sofort'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleRestartCurrentCooldown(cooldownSeconds)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-xs border border-[#d4a359]/40 text-[#d4a359] hover:bg-[#d4a359]/10 cursor-pointer"
                >
                  ⏱️ Auf {formatCooldownDuration(cooldownSeconds)} ab jetzt setzen
                </button>
                <button
                  onClick={handleEndCooldownNow}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-xs bg-[#49b882]/20 border border-[#49b882]/40 text-[#49b882] hover:bg-[#49b882]/30 cursor-pointer"
                >
                  ⚡ Countdown sofort beenden
                </button>
              </div>
            </div>
          </div>
        )}
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
          {members.length > 0 && (
            <button
              onClick={deleteAllMembers}
              disabled={loading}
              className="text-xs uppercase tracking-wider text-red-400 hover:text-red-300 cursor-pointer"
            >
              Alle entfernen ✕
            </button>
          )}
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

                <div className="flex gap-4 pt-1 text-xs items-center flex-wrap">
                  {w.status === 'active' && (
                    <button
                      onClick={() =>
                        updateWaveStatus(w.id, 'reveal', {
                          revealed_at: new Date().toISOString(),
                        })
                      }
                      className="text-[#d4a359] hover:underline cursor-pointer"
                    >
                      Sofort enthüllen →
                    </button>
                  )}
                  {w.status === 'reveal' && (
                    <button
                      onClick={async () => {
                        const nextDate = new Date(Date.now() + cooldownSeconds * 1000).toISOString()
                        await updateWaveStatus(w.id, 'cooldown', { next_wave_at: nextDate })
                      }}
                      className="text-[#d4a359] hover:underline cursor-pointer"
                    >
                      In Ruhephase schicken ({formatCooldownDuration(cooldownSeconds)}) →
                    </button>
                  )}
                  {w.status === 'cooldown' && (
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-[#9c958c]">
                        {w.next_wave_at
                          ? `Endet: ${new Date(w.next_wave_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                          : 'Ruhephase aktiv'}
                      </span>
                      <button
                        onClick={async () => {
                          await updateWaveStatus(w.id, 'cooldown', { next_wave_at: new Date().toISOString() })
                          fetch('/api/generate-wave', { method: 'POST' }).catch(() => {})
                        }}
                        className="text-[#49b882] hover:underline cursor-pointer font-medium"
                      >
                        Jetzt beenden & neue Welle starten →
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => deleteWave(w.id)}
                    className="text-[#7c766e] hover:text-red-400 cursor-pointer ml-auto"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Danger Zone: Release-Reset / Werkseinstellungen */}
      <section className="rounded-2xl p-5 border border-red-500/30 bg-red-950/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xs tracking-[0.22em] uppercase font-semibold text-red-400">
              ⚠️ Release-Reset (Werkseinstellungen)
            </h2>
            <p className="text-[12px] text-[#9c958c] mt-1 leading-relaxed">
              Setzt die gesamte Datenbank für den Start mit deiner Gruppe auf Werkseinstellungen zurück:
              Löscht alle Test-Wellen, Antworten, Reaktionen, Push-Abos und Mitglieder. Die App startet danach
              sauber bei Welle #1.
            </p>
          </div>
          <button
            onClick={handleFactoryReset}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-semibold border border-red-500/60 text-red-300 hover:bg-red-500/20 cursor-pointer whitespace-nowrap self-start sm:self-auto shrink-0"
          >
            App komplett zurücksetzen 💣
          </button>
        </div>
      </section>
    </div>
  )
}
