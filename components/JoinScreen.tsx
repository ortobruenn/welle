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
        <div className="text-center space-y-3">
          <div className="font-display text-6xl font-light" style={{ color: '#d4a359' }}>
            ∿
          </div>
          <h1 className="font-display text-4xl font-light" style={{ color: '#f2efe9' }}>
            Tritt in die Welle ein
          </h1>
          <p className="text-xs leading-relaxed max-w-xs mx-auto" style={{ color: '#9c958c' }}>
            Ein synchroner Raum für euren Freundeskreis. Niemand sieht etwas, bevor nicht alle geantwortet haben.
          </p>
        </div>

        {/* Fast Re-entry for Existing Members */}
        {members.length > 0 && (
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <span className="text-[10px] uppercase tracking-[0.22em] block text-center" style={{ color: '#d4a359' }}>
              Bereits im Kreis? Tippe auf deinen Namen:
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              {members.map(m => (
                <button
                  key={m.id}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSelectExisting(m)}
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer active:scale-95"
                  style={{
                    background: 'rgba(212, 163, 89, 0.14)',
                    border: '1px solid rgba(212, 163, 89, 0.4)',
                    color: '#f2efe9',
                  }}
                >
                  {m.name} →
                </button>
              ))}
            </div>
          </div>
        )}

        {/* New Member Input */}
        <form onSubmit={handleCreateSubmit} className="glass-card rounded-2xl p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-[0.22em] block" style={{ color: '#7c766e' }}>
              {members.length > 0 ? 'Oder neu beitreten als:' : 'Wie heißt du im Freundeskreis?'}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Dein Vorname / Spitzname..."
              maxLength={24}
              className="w-full px-4 py-3.5 rounded-xl text-base focus:outline-none transition-all"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: name.trim()
                  ? '1px solid rgba(212, 163, 89, 0.5)'
                  : '1px solid rgba(255,255,255,0.1)',
                color: '#f2efe9',
              }}
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
            className="w-full py-4 rounded-xl text-xs uppercase tracking-[0.22em] font-semibold transition-all cursor-pointer disabled:opacity-30"
            style={{
              background: name.trim() ? '#d4a359' : '#1b1b22',
              color: name.trim() ? '#070709' : '#7c766e',
            }}
          >
            {loading ? 'Verbinde...' : 'Frequenz betreten ∿'}
          </button>
        </form>
      </div>

      <div className="text-center text-[10px] uppercase tracking-[0.25em]" style={{ color: '#45423e' }}>
        Welle · Synchrones Freundschafts-Ritual
      </div>
    </div>
  )
}
