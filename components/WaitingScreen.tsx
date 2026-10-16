'use client'

import type { Wave, Member, WaveResponse } from '@/lib/types'
import { parseSpectrumResponse, parseChallengeResponse } from '@/lib/mystery'
import WaveVisualizer from './WaveVisualizer'

interface Props {
  wave: Wave
  responses: WaveResponse[]
  members: Member[]
  totalMembers: number
  userResponse: WaveResponse | null
}

export default function WaitingScreen({
  wave,
  responses,
  members,
  totalMembers,
  userResponse,
}: Props) {
  const respondedIds = new Set(responses.map(r => r.member_id))
  const respondedCount = responses.length
  const remaining = Math.max(0, totalMembers - respondedCount)

  const isSpectrum = wave.prompt_type === 'spectrum'
  const isChallenge =
    wave.prompt_type === 'memory' ||
    wave.prompt_type === 'logic' ||
    wave.prompt_type === 'scramble'
  const specData =
    isSpectrum && userResponse ? parseSpectrumResponse(userResponse.content) : null
  const challengeData =
    isChallenge && userResponse ? parseChallengeResponse(userResponse.content) : null

  return (
    <div className="flex-1 flex flex-col items-center justify-between px-5 pb-10 pt-4 max-w-xl mx-auto w-full">
      {/* Top Visualizer */}
      <div className="w-full space-y-2">
        <WaveVisualizer variant="calm" intensity={0.75} height={56} />
        <p className="text-center text-[11px] uppercase tracking-[0.25em]" style={{ color: '#7c766e' }}>
          Synchroner Warteraum · {respondedCount} von {totalMembers} versiegelt
        </p>
      </div>

      {/* Center: Prompt & Live Member Orbs */}
      <div className="my-auto py-6 w-full space-y-8 text-center animate-fade-up">
        <div className="space-y-2 px-3">
          <span className="text-xs uppercase tracking-[0.2em]" style={{ color: '#d4a359' }}>
            Welle #{wave.number}
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-light leading-snug" style={{ color: '#f2efe9' }}>
            {wave.prompt}
          </h2>
        </div>

        {/* Member Constellation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md mx-auto">
          {members.map(m => {
            const isDone = respondedIds.has(m.id)
            return (
              <div
                key={m.id}
                className="p-3.5 rounded-2xl flex flex-col items-center gap-2 transition-all duration-500"
                style={{
                  background: isDone ? 'rgba(212, 163, 89, 0.11)' : 'rgba(255,255,255,0.025)',
                  border: isDone
                    ? '1px solid rgba(212, 163, 89, 0.45)'
                    : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold relative"
                  style={{
                    background: isDone ? '#d4a359' : 'rgba(255,255,255,0.06)',
                    color: isDone ? '#070709' : '#7c766e',
                    boxShadow: isDone ? '0 0 18px rgba(212, 163, 89, 0.4)' : 'none',
                  }}
                >
                  {m.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-medium truncate max-w-[100px]" style={{ color: '#f2efe9' }}>
                    {m.name}
                  </p>
                  <p
                    className="text-[10px] uppercase tracking-wider"
                    style={{ color: isDone ? '#49b882' : '#7c766e' }}
                  >
                    {isDone ? '✓ Versiegelt' : 'Offen...'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Status Message */}
        <div className="space-y-2">
          {remaining === 0 ? (
            <p className="text-xs uppercase tracking-[0.25em] animate-pulse" style={{ color: '#d4a359' }}>
              Alle sind da · Enthüllung öffnet sich...
            </p>
          ) : (
            <p className="text-xs" style={{ color: '#7c766e' }}>
              Sobald {remaining === 1 ? 'die letzte Person antwortet' : `die letzten ${remaining} Personen antworten`}, bricht das Siegel für alle gleichzeitig auf.
            </p>
          )}
        </div>
      </div>

      {/* User's Own Sealed Response Preview */}
      {userResponse && (
        <div className="w-full max-w-md glass-card rounded-2xl p-4 animate-fade-up">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: '#d4a359' }}>
              🔒 Dein hinterlegter Beitrag
            </span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#49b882' }}>
              Sicher verwahrt
            </span>
          </div>

          {isChallenge && challengeData ? (
            <div className="flex items-center justify-between text-xs pt-1" style={{ color: '#f2efe9' }}>
              <span className="font-medium" style={{ color: challengeData.passed ? '#49b882' : '#e05a47' }}>
                {challengeData.passed ? '🏆 Geschafft' : '🩹 Trostpflaster'}
              </span>
              <span>{challengeData.detail}</span>
            </div>
          ) : isSpectrum && specData ? (
            <div className="flex items-center justify-between text-xs pt-1" style={{ color: '#f2efe9' }}>
              <span>
                Dein Puls: <strong>{specData.self}%</strong>
              </span>
              <span style={{ color: '#49b882' }}>
                Gruppen-Tipp: <strong>{specData.guessAvg}%</strong>
              </span>
            </div>
          ) : userResponse.content.startsWith('data:image/') ? (
            <div className="flex justify-center pt-1">
              <img
                src={userResponse.content}
                alt="Deine Skizze"
                className="w-28 h-28 object-contain rounded-xl border"
                style={{ borderColor: 'rgba(255,255,255,0.1)', background: '#09090c' }}
              />
            </div>
          ) : (
            <p className="font-display italic text-lg leading-snug" style={{ color: '#f2efe9' }}>
              „{userResponse.content}“
            </p>
          )}
        </div>
      )}
    </div>
  )
}
