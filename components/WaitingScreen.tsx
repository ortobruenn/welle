'use client'

import type { Wave, Member, WaveResponse } from '@/lib/types'
import { extractVibeOptions } from '@/lib/mystery'
import PushNotificationPrompt from '@/components/PushNotificationPrompt'

interface Props {
  wave: Wave
  responses: WaveResponse[]
  members: Member[]
  totalMembers: number
  userResponse: WaveResponse | null
}

export default function WaitingScreen({ wave, responses, totalMembers, userResponse }: Props) {
  const responded = responses.length
  const remaining = totalMembers - responded

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8"
      style={{ background: '#0a0a0a' }}
    >
      {/* Symbol */}
      <div
        className="font-display text-5xl font-light mb-16 animate-breathe"
        style={{ color: '#c8a065' }}
      >
        ∿
      </div>

      {/* Dots */}
      <div className="flex gap-4 mb-16">
        {Array.from({ length: totalMembers }).map((_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-full transition-all duration-700"
            style={{
              background: i < responded ? '#c8a065' : 'transparent',
              border: `1.5px solid ${i < responded ? '#c8a065' : '#2a2a2a'}`,
            }}
          />
        ))}
      </div>

      {/* Status text */}
      <div className="text-center animate-fade-in">
        {remaining === 0 ? (
          <p className="text-sm tracking-[0.2em] uppercase" style={{ color: '#c8a065' }}>
            enthüllung folgt
          </p>
        ) : (
          <>
            <p
              className="font-display text-5xl font-light mb-4"
              style={{ color: '#e8e4de' }}
            >
              {remaining}
            </p>
            <p className="text-xs tracking-[0.25em] uppercase" style={{ color: '#6b6560' }}>
              {remaining === 1 ? 'wartet noch' : 'warten noch'}
            </p>
          </>
        )}
      </div>

      {/* User's own response preview */}
      {userResponse && (
        <div
          className="mt-16 w-full max-w-xs p-5 border animate-fade-up"
          style={{
            borderColor: '#1e1e1e',
            background: '#0f0f0f',
            borderRadius: 2,
          }}
        >
          <p className="text-xs tracking-[0.2em] uppercase mb-3" style={{ color: '#6b6560' }}>
            Deine Antwort
          </p>
          {wave.prompt_type === 'spectrum' ? (
            <div className="flex items-center gap-3 py-1">
              <span className="font-display text-2xl text-[#c8a065]">⚖️</span>
              <p className="text-sm text-[#e8e4de]">
                Position im Spektrum eingeprägt.
              </p>
            </div>
          ) : wave.prompt_type === 'pulse' ? (
            <div className="flex items-center gap-3 py-1">
              <span className="font-display text-2xl text-[#c8a065] animate-breathe">∿</span>
              <p className="text-sm text-[#e8e4de]">
                Dein Puls wurde übertragen.
              </p>
            </div>
          ) : wave.prompt_type === 'silence' ? (
            <div className="flex items-center gap-3 py-1">
              <span className="font-display text-2xl text-[#c8a065]">🧘</span>
              <p className="text-sm text-[#e8e4de]">
                Stiller Moment vollzogen.
              </p>
            </div>
          ) : wave.prompt_type === 'vibe' ? (
            <div className="flex flex-col gap-2 my-1">
              <p className="text-base font-display text-[#c8a065]">„{userResponse.content}“</p>
              {(() => {
                const vibeItem = extractVibeOptions(wave.options)?.find(
                  v => v.title === userResponse.content || v.id === userResponse.content
                )
                if (!vibeItem?.imageUrl) return null
                return (
                  <div className="w-full aspect-video rounded overflow-hidden border border-[#2a2a2a] bg-[#141414]">
                    <img src={vibeItem.imageUrl} alt={vibeItem.title} className="w-full h-full object-cover" />
                  </div>
                )
              })()}
            </div>
          ) : userResponse.content.startsWith('data:image/') ? (
            <div className="w-full aspect-square rounded overflow-hidden border border-[#2a2a2a] my-1">
              <img
                src={userResponse.content}
                alt="Deine Kreation"
                className={`w-full h-full ${
                  wave.prompt_type === 'draw' ? 'object-contain bg-[#0a0a0a]' : 'object-cover'
                }`}
              />
            </div>
          ) : (
            <p className="text-base leading-relaxed" style={{ color: '#e8e4de' }}>
              {userResponse.content}
            </p>
          )}
        </div>
      )}

      {userResponse && (
        <PushNotificationPrompt memberId={userResponse.member_id} className="mt-6" />
      )}

      {/* Wave info */}
      <p
        className="absolute bottom-10 text-xs tracking-[0.25em] uppercase"
        style={{ color: '#2a2a2a' }}
      >
        Welle {wave.number}
      </p>
    </div>
  )
}
