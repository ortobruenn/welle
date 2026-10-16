'use client'

import { useState } from 'react'
import type { Member, Wave, WaveResponse } from '@/lib/types'
import PushBell from './PushBell'
import ChronicleModal from './ChronicleModal'

interface Props {
  wave: Wave | null
  members: Member[]
  responses: WaveResponse[]
  currentMember: Member | null
}

const FORMAT_META: Record<string, { label: string; icon: string; badgeColor: string }> = {
  text: { label: 'Blind-Beichte', icon: '🔒', badgeColor: '#d4a359' },
  undercover: { label: 'Sabotage', icon: '🕵️', badgeColor: '#e05a47' },
  spectrum: { label: 'Spektrum', icon: '🎚️', badgeColor: '#d4a359' },
  draw: { label: '35s-Blindfunk', icon: '🎨', badgeColor: '#d4a359' },
  photo: { label: 'Foto', icon: '📷', badgeColor: '#d4a359' },
  memory: { label: '35s-Tresor', icon: '🧠', badgeColor: '#49b882' },
  logic: { label: 'Logik-Falle', icon: '🧩', badgeColor: '#49b882' },
  scramble: { label: '35s-Kniffel', icon: '⚡', badgeColor: '#49b882' },
  choice: { label: 'Dilemma', icon: '⚖️', badgeColor: '#d4a359' },
  pulse: { label: '7s-Puls', icon: '🫧', badgeColor: '#d4a359' },
}

export default function TopBar({ wave, members, responses, currentMember }: Props) {
  const [chronicleOpen, setChronicleOpen] = useState(false)

  const respondedSet = new Set(responses.map(r => r.member_id))
  const fmt = wave ? FORMAT_META[wave.prompt_type] || { label: 'Welle', icon: '∿', badgeColor: '#d4a359' } : null

  return (
    <>
      <header className="w-full max-w-xl mx-auto px-4 pt-4 pb-2 z-30">
        <div
          className="relative flex items-center justify-between gap-2 pl-4 pr-3 py-2.5 rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(22,22,27,0.85), rgba(14,14,18,0.85))',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            boxShadow: '0 12px 32px -14px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
            backdropFilter: 'blur(18px)',
          }}
        >
          {/* Akzent-Haarlinie oben */}
          <span
            aria-hidden
            className="absolute top-0 left-6 right-6 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(212,163,89,0.7), transparent)' }}
          />

          {/* Left: Brand & Current Wave Badge */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-display text-[26px] leading-none select-none" style={{ color: '#d4a359' }}>
              ∿
            </span>
            {wave ? (
              <div className="flex items-center gap-2 truncate">
                <span className="label-mono" style={{ color: '#f2efe9' }}>
                  Nº{String(wave.number).padStart(2, '0')}
                </span>
                {fmt && (
                  <span
                    className="chip truncate"
                    style={{
                      background: `${fmt.badgeColor}14`,
                      color: fmt.badgeColor,
                      border: `1px solid ${fmt.badgeColor}33`,
                    }}
                  >
                    {fmt.label}
                  </span>
                )}
              </div>
            ) : (
              <span className="label-mono is-accent">Welle</span>
            )}
          </div>

          {/* Center: Live Member Slots */}
          {members.length > 0 && (
            <div className="hidden xs:flex items-center gap-1.5">
              {members.map(m => {
                const hasAnswered = respondedSet.has(m.id)
                const isMe = m.id === currentMember?.id
                return (
                  <div
                    key={m.id}
                    title={`${m.name}${isMe ? ' (Du)' : ''}: ${hasAnswered ? 'Bereit' : 'Offen'}`}
                    className="relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all"
                    style={{
                      background: hasAnswered ? 'rgba(212, 163, 89, 0.22)' : 'rgba(255,255,255,0.03)',
                      border: hasAnswered
                        ? '1px solid rgba(212, 163, 89, 0.7)'
                        : '1px dashed rgba(255,255,255,0.18)',
                      color: hasAnswered ? '#f2efe9' : '#7c766e',
                      boxShadow: isMe ? '0 0 0 2px rgba(212,163,89,0.18)' : 'none',
                    }}
                  >
                    {m.name.slice(0, 1).toUpperCase()}
                    {hasAnswered && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                        style={{ background: '#49b882', boxShadow: '0 0 6px #49b882' }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Right: Chronik & PushBell */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setChronicleOpen(true)}
              className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ color: '#d8d3cb', background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' }}
            >
              <span aria-hidden>≡</span>
              <span>Chronik</span>
            </button>
            <PushBell memberId={currentMember?.id} />
          </div>
        </div>
      </header>

      <ChronicleModal
        isOpen={chronicleOpen}
        onClose={() => setChronicleOpen(false)}
        members={members}
      />
    </>
  )
}
