'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Wave, WaveResponse, Member } from '@/lib/types'
import {
  extractEcho,
  extractUndercover,
  parseSpectrumResponse,
  parseChallengeResponse,
  cleanOptions,
} from '@/lib/mystery'

interface Props {
  isOpen: boolean
  onClose: () => void
  members: Member[]
}

interface PastWaveItem extends Wave {
  responses: WaveResponse[]
}

const FORMAT_LABELS: Record<string, { label: string; icon: string }> = {
  text: { label: 'Blind-Beichte', icon: '🔒' },
  undercover: { label: 'Sabotage', icon: '🕵️' },
  spectrum: { label: 'Spektrum', icon: '🎚️' },
  draw: { label: '35s-Blindfunk', icon: '🎨' },
  photo: { label: 'Schnappschuss', icon: '📷' },
  memory: { label: '35s-Tresor', icon: '🧠' },
  logic: { label: 'Logik-Falle', icon: '🧩' },
  scramble: { label: '35s-Kniffel', icon: '⚡' },
  choice: { label: 'Dilemma', icon: '⚖️' },
  pulse: { label: '7s-Puls', icon: '🫧' },
}

export default function ChronicleModal({ isOpen, onClose, members }: Props) {
  const [pastWaves, setPastWaves] = useState<PastWaveItem[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const loadHistory = async () => {
      setLoading(true)
      const { data: waves } = await supabase
        .from('waves')
        .select('*, responses(*, members(*))')
        .in('status', ['reveal', 'cooldown'])
        .order('number', { ascending: false })
        .limit(25)

      const list = ((waves || []) as PastWaveItem[]).filter(
        w => w.responses && w.responses.length > 0
      )
      setPastWaves(list)
      if (list.length > 0 && !expandedId) {
        setExpandedId(list[0].id)
      }
      setLoading(false)
    }
    loadHistory()
  }, [isOpen])

  if (!isOpen) return null

  const getMemberName = (memberId: string, fallback?: string) => {
    const found = members.find(m => m.id === memberId)
    return found?.name || fallback || 'Freund'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      style={{ background: 'rgba(4, 4, 6, 0.85)', backdropFilter: 'blur(14px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden glass-card"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg" style={{ color: '#d4a359' }}>
                ∿
              </span>
              <span className="text-xs uppercase tracking-[0.25em] font-medium" style={{ color: '#d4a359' }}>
                Gruppen-Chronik
              </span>
            </div>
            <h2 className="font-display text-2xl font-light mt-0.5" style={{ color: '#f2efe9' }}>
              Vergangene Wellen & Echos
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm transition-colors cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: '#9c958c',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3.5">
          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: '#7c766e' }}>
              Lade Erinnerungen...
            </div>
          ) : pastWaves.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <p className="font-display text-2xl italic" style={{ color: '#9c958c' }}>
                Noch keine vollendeten Wellen.
              </p>
              <p className="text-xs" style={{ color: '#6b6560' }}>
                Sobald eure erste gemeinsame Welle enthüllt wurde, bleibt sie hier im Gedächtnis.
              </p>
            </div>
          ) : (
            pastWaves.map(w => {
              const isOpenCard = expandedId === w.id
              const echo = extractEcho(w.options)
              const undercover = w.prompt_type === 'undercover' ? extractUndercover(w.options) : null
              const poles = cleanOptions(w.options)
              const fmt = FORMAT_LABELS[w.prompt_type] || { label: w.prompt_type, icon: '∿' }
              const isChal =
                w.prompt_type === 'memory' ||
                w.prompt_type === 'logic' ||
                w.prompt_type === 'scramble'

              return (
                <div
                  key={w.id}
                  className="rounded-2xl transition-all overflow-hidden"
                  style={{
                    background: isOpenCard ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.018)',
                    border: isOpenCard
                      ? '1px solid rgba(212, 163, 89, 0.28)'
                      : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <button
                    onClick={() => setExpandedId(isOpenCard ? null : w.id)}
                    className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: 'rgba(212, 163, 89, 0.12)',
                            color: '#d4a359',
                          }}
                        >
                          Welle #{w.number}
                        </span>
                        <span className="text-xs" style={{ color: '#7c766e' }}>
                          {fmt.icon} {fmt.label}
                        </span>
                      </div>
                      <p className="font-display text-xl font-light leading-snug" style={{ color: '#f2efe9' }}>
                        {w.prompt}
                      </p>
                    </div>
                    <span className="text-xs mt-1" style={{ color: '#7c766e' }}>
                      {isOpenCard ? '−' : '+'}
                    </span>
                  </button>

                  {isOpenCard && (
                    <div
                      className="px-5 pb-5 pt-2 space-y-4 border-t"
                      style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                    >
                      {echo && (
                        <div
                          className="px-4 py-3 rounded-xl"
                          style={{
                            background: 'rgba(212, 163, 89, 0.07)',
                            border: '1px solid rgba(212, 163, 89, 0.2)',
                          }}
                        >
                          <p
                            className="text-[10px] uppercase tracking-[0.2em] mb-1"
                            style={{ color: '#d4a359' }}
                          >
                            ∿ Das Echo
                          </p>
                          <p className="font-display italic text-base leading-relaxed" style={{ color: '#e8e4de' }}>
                            „{echo}“
                          </p>
                        </div>
                      )}

                      {undercover && (
                        <div
                          className="px-3.5 py-2.5 rounded-xl text-xs"
                          style={{
                            background: 'rgba(224, 90, 71, 0.1)',
                            border: '1px solid rgba(224, 90, 71, 0.28)',
                            color: '#f0b8b0',
                          }}
                        >
                          🕵️ Maulwurf war{' '}
                          <strong style={{ color: '#e05a47' }}>
                            {getMemberName(undercover.memberId, undercover.memberName)}
                          </strong>
                          : „{undercover.prompt}“
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-2.5">
                        {w.responses.map(r => {
                          const author = getMemberName(r.member_id, r.members?.name)
                          const isImg = (r.content || '').startsWith('data:image/')
                          const isSpec = w.prompt_type === 'spectrum'
                          const specData = isSpec ? parseSpectrumResponse(r.content) : null
                          const chalData = isChal ? parseChallengeResponse(r.content) : null

                          return (
                            <div
                              key={r.id}
                              className="px-3.5 py-3 rounded-xl flex items-start justify-between gap-3"
                              style={{
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.05)',
                              }}
                            >
                              <div className="flex-1 min-w-0">
                                <span
                                  className="text-[11px] uppercase tracking-wider font-medium block mb-1"
                                  style={{ color: '#d4a359' }}
                                >
                                  {author}
                                </span>
                                {isImg ? (
                                  <img
                                    src={r.content}
                                    alt={author}
                                    className="w-36 h-36 object-contain rounded-lg border"
                                    style={{
                                      background: '#0a0a0c',
                                      borderColor: 'rgba(255,255,255,0.08)',
                                    }}
                                  />
                                ) : isChal && chalData ? (
                                  <div className="text-xs flex items-center justify-between" style={{ color: '#e8e4de' }}>
                                    <span>{chalData.detail}</span>
                                    <span
                                      className="font-semibold"
                                      style={{ color: chalData.passed ? '#49b882' : '#e05a47' }}
                                    >
                                      {chalData.passed
                                        ? `🏆 ${(chalData.timeMs / 1000).toFixed(1).replace('.', ',')}s`
                                        : '🩹 Trostpflaster'}
                                    </span>
                                  </div>
                                ) : isSpec && specData ? (
                                  <div className="text-xs space-y-1" style={{ color: '#d8d3cb' }}>
                                    <div>
                                      Eigener Puls: <strong>{specData.self}%</strong>
                                      {poles && poles.length >= 2 && (
                                        <span style={{ color: '#7c766e' }}>
                                          {' '}
                                          ({specData.self < 50 ? poles[0] : poles[1]})
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ color: '#7c766e' }}>
                                      Gruppen-Tipp: {specData.guessAvg}%
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm leading-relaxed" style={{ color: '#e8e4de' }}>
                                    {r.content}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
