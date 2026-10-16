'use client'

import { useState } from 'react'
import type { Wave, Member } from '@/lib/types'
import {
  extractUndercover,
  cleanOptions,
  extractLogicConfig,
  extractScrambleConfig,
} from '@/lib/mystery'
import DrawCanvas from './DrawCanvas'
import PhotoCapture from './PhotoCapture'
import SpectrumSlider from './SpectrumSlider'
import MemoryVault from './MemoryVault'
import LogicRiddle from './LogicRiddle'
import ScrambleChallenge from './ScrambleChallenge'
import WaveVisualizer from './WaveVisualizer'

interface Props {
  wave: Wave
  member: Member
  members?: Member[]
  onSubmit: (content: string) => Promise<void>
}

export default function WaveScreen({ wave, member, onSubmit }: Props) {
  const [answer, setAnswer] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [mediaContent, setMediaContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isUndercover = wave.prompt_type === 'undercover'
  const undercoverInfo = isUndercover ? extractUndercover(wave.options) : null
  const isMole = isUndercover && undercoverInfo?.memberId === member.id
  const choices = cleanOptions(wave.options)

  const handleSubmit = async (overrideContent?: string) => {
    let content = overrideContent

    if (!content) {
      if (wave.prompt_type === 'choice') content = selected || ''
      else if (wave.prompt_type === 'draw') content = mediaContent
      else content = answer.trim()
    }

    if (!content) return
    setLoading(true)
    setError(null)
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25)
      }
      await onSubmit(content)
    } catch (err) {
      console.error('Failed to submit wave response:', err)
      setError('Konnte nicht gesendet werden. Bitte erneut versuchen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-5 pb-10 pt-2 max-w-xl mx-auto w-full">
      {/* Top Wave Visualizer & Mode Briefing */}
      <div className="space-y-4 animate-fade-in">
        <WaveVisualizer
          variant={isMole ? 'danger' : isUndercover ? 'amber' : 'amber'}
          intensity={isMole ? 1.35 : 1}
          height={54}
        />

        {/* Format Briefing Pill */}
        <div className="flex justify-center">
          {isUndercover ? (
            isMole ? (
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] uppercase tracking-[0.22em] font-semibold"
                style={{
                  background: 'rgba(224, 90, 71, 0.16)',
                  border: '1px solid rgba(224, 90, 71, 0.5)',
                  color: '#e05a47',
                  boxShadow: '0 0 24px rgba(224, 90, 71, 0.25)',
                }}
              >
                <span>🕵️</span>
                <span>Du bist der Maulwurf · Geheime Sabotage</span>
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] uppercase tracking-[0.2em]"
                style={{
                  background: 'rgba(212, 163, 89, 0.1)',
                  border: '1px solid rgba(212, 163, 89, 0.3)',
                  color: '#d4a359',
                }}
              >
                <span>🕵️</span>
                <span>Einer aus der Runde spielt heute falsch...</span>
              </div>
            )
          ) : wave.prompt_type === 'draw' ? (
            <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: '#7c766e' }}>
              🎨 35-Sekunden-Blindfunk · Danach wird geraten, wer was gemalt hat
            </span>
          ) : wave.prompt_type === 'photo' ? (
            <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: '#7c766e' }}>
              📷 Live-Schnappschuss · Direkt aus deiner Kamera
            </span>
          ) : wave.prompt_type === 'spectrum' ? (
            <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: '#7c766e' }}>
              🎚️ Frequenz-Abgleich · Dein Puls & deine Gruppenschätzung
            </span>
          ) : wave.prompt_type === 'memory' ? (
            <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: '#d4a359' }}>
              🧠 35s-Gedächtnis-Tresor · Knack den Code oder kassiere das Trostpflaster 🩹
            </span>
          ) : wave.prompt_type === 'logic' ? (
            <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: '#d4a359' }}>
              🧩 35s-Logik-Falle · 1 Versuch – Ruhmeshalle oder Trostpflaster 🩹
            </span>
          ) : wave.prompt_type === 'scramble' ? (
            <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: '#d4a359' }}>
              ⚡ 35s-Kniffel-Sprint · Jeder für sich gegen die Uhr
            </span>
          ) : (
            <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: '#7c766e' }}>
              🔒 Anonyme Blind-Beichte · Erst beim Reveal wird geraten
            </span>
          )}
        </div>
      </div>

      {/* Main Prompt Card & Input Area */}
      <div className="my-auto py-6 space-y-7 animate-fade-up">
        {/* Official Group Prompt */}
        <div className="text-center space-y-3 px-2">
          {isMole && (
            <span
              className="text-[10px] uppercase tracking-[0.22em] block"
              style={{ color: '#7c766e' }}
            >
              Offizielle Gruppen-Frage (die alle anderen sehen):
            </span>
          )}
          <h1
            className="font-display text-3xl sm:text-4xl font-light leading-snug"
            style={{ color: '#f2efe9' }}
          >
            {wave.prompt}
          </h1>
        </div>

        {/* Secret Mole Briefing Card (ONLY visible to the chosen Mole!) */}
        {isMole && undercoverInfo && (
          <div className="glass-card-danger rounded-2xl p-5 space-y-2 animate-scale-in">
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] uppercase tracking-[0.24em] font-semibold"
                style={{ color: '#e05a47' }}
              >
                ⚠️ Geheimer Sabotage-Auftrag für {member.name}
              </span>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: '#f0b8b0' }}>
                Streng geheim
              </span>
            </div>
            <p className="text-sm sm:text-base leading-relaxed font-medium" style={{ color: '#f8e9e6' }}>
              {undercoverInfo.prompt}
            </p>
            <p className="text-[11px]" style={{ color: '#c48c84' }}>
              Tipp: Formuliere so, dass deine Antwort auf den ersten Blick zur Hauptfrage oben passt!
            </p>
          </div>
        )}

        {/* INTERACTION FORMATS */}
        {wave.prompt_type === 'memory' ? (
          <MemoryVault
            waveId={wave.id}
            waveNumber={wave.number}
            onSubmit={payload => handleSubmit(payload)}
            disabled={loading}
          />
        ) : wave.prompt_type === 'logic' ? (
          <LogicRiddle
            config={extractLogicConfig(wave.options)}
            onSubmit={payload => handleSubmit(payload)}
            disabled={loading}
          />
        ) : wave.prompt_type === 'scramble' ? (
          <ScrambleChallenge
            config={extractScrambleConfig(wave.options, `${wave.id}-${wave.number}`)}
            onSubmit={payload => handleSubmit(payload)}
            disabled={loading}
          />
        ) : wave.prompt_type === 'spectrum' ? (
          <SpectrumSlider
            poleA={choices?.[0] || '0% Minimal'}
            poleB={choices?.[1] || '100% Maximal'}
            onComplete={content => handleSubmit(content)}
          />
        ) : wave.prompt_type === 'photo' ? (
          <PhotoCapture
            onSubmitPhoto={dataUrl => handleSubmit(dataUrl)}
            isSubmitting={loading}
          />
        ) : wave.prompt_type === 'draw' ? (
          <div className="space-y-5">
            <DrawCanvas onSave={dataUrl => setMediaContent(dataUrl)} />
            <button
              onClick={() => handleSubmit()}
              disabled={!mediaContent || loading}
              className="w-full py-4 rounded-2xl text-xs uppercase tracking-[0.22em] font-semibold transition-all duration-300 cursor-pointer disabled:opacity-30"
              style={{
                background: mediaContent ? '#d4a359' : '#1b1b20',
                color: mediaContent ? '#070709' : '#7c766e',
                boxShadow: mediaContent ? '0 10px 30px -8px rgba(212, 163, 89, 0.5)' : 'none',
              }}
            >
              {loading ? 'Versiegelt...' : 'Skizze anonym versiegeln ∿'}
            </button>
          </div>
        ) : wave.prompt_type === 'choice' && choices && choices.length >= 2 ? (
          <div className="space-y-3">
            {choices.map((option, i) => {
              const isSelected = selected === option
              return (
                <button
                  key={i}
                  onClick={() => setSelected(option)}
                  className="w-full text-left px-5 py-4 rounded-2xl text-base transition-all cursor-pointer"
                  style={{
                    background: isSelected ? 'rgba(212, 163, 89, 0.14)' : 'rgba(255,255,255,0.03)',
                    border: isSelected
                      ? '1px solid rgba(212, 163, 89, 0.65)'
                      : '1px solid rgba(255,255,255,0.08)',
                    color: isSelected ? '#f2efe9' : '#9c958c',
                  }}
                >
                  {option}
                </button>
              )
            })}
            <button
              onClick={() => handleSubmit()}
              disabled={!selected || loading}
              className="w-full mt-3 py-4 rounded-2xl text-xs uppercase tracking-[0.22em] font-semibold transition-all cursor-pointer disabled:opacity-30"
              style={{
                background: selected ? '#d4a359' : '#1b1b20',
                color: selected ? '#070709' : '#7c766e',
              }}
            >
              {loading ? 'Wird gesendet...' : 'Wahl versiegeln ∿'}
            </button>
          </div>
        ) : (
          /* Default: TEXT (Blind-Beichte) & UNDERCOVER (Sabotage) */
          <div className="space-y-4">
            <div
              className="rounded-2xl p-4 transition-all"
              style={{
                background: 'rgba(18, 18, 23, 0.9)',
                border: answer.trim()
                  ? isMole
                    ? '1px solid rgba(224, 90, 71, 0.5)'
                    : '1px solid rgba(212, 163, 89, 0.45)'
                  : '1px solid rgba(255, 255, 255, 0.09)',
              }}
            >
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder={
                  isMole
                    ? 'Schreibe deine getarnte Antwort...'
                    : 'Dein ehrlicher Gedanke (bleibt bis zur Enthüllung unter Verschluss)...'
                }
                rows={4}
                maxLength={280}
                autoFocus
                className="w-full bg-transparent text-base sm:text-lg font-light leading-relaxed focus:outline-none resize-none"
                style={{ color: '#f2efe9' }}
              />
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]" style={{ color: '#7c766e' }}>
                <span>
                  {isUndercover
                    ? '🕵️ Beim Reveal wird abgestimmt, wer der Maulwurf war'
                    : '🔒 Anonym bis alle geantwortet haben'}
                </span>
                <span>{answer.length}/280</span>
              </div>
            </div>

            {error && (
              <p className="text-xs text-center" style={{ color: '#e05a47' }}>
                {error}
              </p>
            )}

            <button
              onClick={() => handleSubmit()}
              disabled={!answer.trim() || loading}
              className="w-full py-4 rounded-2xl text-xs uppercase tracking-[0.22em] font-semibold transition-all duration-300 cursor-pointer disabled:opacity-30 active:scale-98"
              style={{
                background: answer.trim() ? (isMole ? '#e05a47' : '#d4a359') : '#1b1b20',
                color: answer.trim() ? '#070709' : '#7c766e',
                boxShadow: answer.trim()
                  ? isMole
                    ? '0 10px 30px -8px rgba(224, 90, 71, 0.5)'
                    : '0 10px 30px -8px rgba(212, 163, 89, 0.5)'
                  : 'none',
              }}
            >
              {loading
                ? 'Wird versiegelt...'
                : isMole
                ? 'Sabotage-Antwort einschleusen 🕵️'
                : 'Antwort versiegeln ∿'}
            </button>
          </div>
        )}
      </div>

      <div className="h-2" />
    </div>
  )
}
