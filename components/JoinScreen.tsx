'use client'

import { useState } from 'react'
import type { Member } from '@/lib/types'
import WaveVisualizer from './WaveVisualizer'

interface Props {
  members?: Member[]
  onJoin: (name: string, enablePush?: boolean, existingMember?: Member) => Promise<void>
}

export default function JoinScreen({ members = [], onJoin }: Props) {
  const [name, setName] = useState('')
  const [enablePush, setEnablePush] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || loading) return
    setLoading(true)
    try {
      await onJoin(name.trim(), enablePush)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectExisting = async (m: Member) => {
    if (loading) return
    setLoading(true)
    try {
      await onJoin(m.name, enablePush, m)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between px-6 py-12 max-w-md mx-auto w-full">
      <div className="pt-4">
        <WaveVisualizer variant="amber" intensity={0.9} height={60} />
      </div>

      <div className="my-auto space-y-8 animate-fade-up">
        {/* Title */}
        <div className="text-center space-y-4">
          <div
            className="font-display text-6xl font-light animate-float"
            style={{ color: '#d4a359', textShadow: '0 0 32px rgba(212,163,89,0.45)' }}
          >
            ∿
          </div>
          <h1 className="title-display text-[42px]">
            Tritt in die <em>Welle</em> ein
          </h1>
          <p className="text-[13px] leading-relaxed max-w-xs mx-auto" style={{ color: '#9c958c' }}>
            Ein synchroner Raum für euren Freundeskreis. Niemand sieht etwas, bevor nicht alle geantwortet haben.
          </p>
        </div>

        {/* Fast Re-entry for Existing Members */}
        {members.length > 0 && (
          <div className="glass-card rounded-2xl p-5 space-y-3.5">
            <span className="label-mono is-accent block text-center">
              Bereits im Kreis? Wähle deinen Namen
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              {members.map(m => (
                <button
                  key={m.id}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSelectExisting(m)}
                  className="btn-ghost inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full"
                  style={{ color: '#f2efe9', letterSpacing: '0.04em', textTransform: 'none', fontSize: 13 }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold"
                    style={{ background: '#d4a359', color: '#120d04' }}
                  >
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* New Member Input */}
        <form onSubmit={handleCreateSubmit} className="glass-card rounded-2xl p-6 space-y-4">
          <div className="space-y-2">
            <label className="label-mono block">
              {members.length > 0 ? 'Oder neu beitreten als' : 'Wie heißt du im Freundeskreis?'}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Dein Vorname / Spitzname…"
              maxLength={24}
              className="input-field w-full px-4 py-3.5 rounded-xl text-base"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={enablePush}
              onChange={e => setEnablePush(e.target.checked)}
              className="accent-[#d4a359] w-4 h-4 rounded"
            />
            <span className="text-xs" style={{ color: '#9c958c' }}>
              Push-Signal aktivieren, wenn eine neue Welle anrollt
            </span>
          </label>

          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="btn-primary w-full py-4 rounded-xl"
          >
            {loading ? 'Verbinde…' : 'Frequenz betreten ∿'}
          </button>
        </form>
      </div>

      <div className="label-mono text-center" style={{ color: '#55514b', letterSpacing: '0.28em' }}>
        Welle · Synchrones Freundschafts-Ritual
      </div>
    </div>
  )
}
