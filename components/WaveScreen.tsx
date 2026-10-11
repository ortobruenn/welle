'use client'

import { useState } from 'react'
import type { Wave, Member } from '@/lib/types'
import { extractGlitch, cleanOptions, extractEnigma, extractVibeOptions } from '@/lib/mystery'
import DrawCanvas from './DrawCanvas'
import PhotoCapture from './PhotoCapture'
import PulseTouch from './PulseTouch'
import SilenceMoment from './SilenceMoment'
import SpectrumSlider from './SpectrumSlider'
import EnigmaPuzzle from './EnigmaPuzzle'
import VibeSelector from './VibeSelector'

interface Props {
  wave: Wave
  member: Member
  members?: Member[]
  onSubmit: (content: string) => Promise<void>
}

export default function WaveScreen({ wave, member, members, onSubmit }: Props) {
  const [answer, setAnswer] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [mediaContent, setMediaContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const glitch = extractGlitch(wave.options)
  const isGlitchTarget = glitch?.memberId === member.id
  const displayPrompt = isGlitchTarget ? glitch.prompt : wave.prompt
  const choices = cleanOptions(wave.options)
  const vibeOptions = extractVibeOptions(wave.options)

  const handleSubmit = async (overrideContent?: string) => {
    let content = overrideContent

    if (!content) {
      if (wave.prompt_type === 'choice' || wave.prompt_type === 'vibe') content = selected || ''
      else if (wave.prompt_type === 'draw' || wave.prompt_type === 'photo') content = mediaContent
      else content = answer.trim()
    }

    if (!content) return
    setLoading(true)
    setError(null)
    try {
      await onSubmit(content)
    } catch (err) {
      console.error('Failed to submit wave response:', err)
      setError('Failed to submit response. Please try again.')
    }
    setLoading(false)
  }

  const handleSubmitClick = (e: React.MouseEvent) => {
    e.preventDefault()
    handleSubmit()
  }

  return (
    <div
      className="min-h-screen flex flex-col px-8 py-12 max-w-lg mx-auto"
      style={{ background: '#0a0a0a' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-10 animate-fade-in">
        <span className="text-xs tracking-[0.3em] uppercase" style={{ color: '#6b6560' }}>
          Welle {wave.number}
        </span>
        <span className="text-xs tracking-[0.2em]" style={{ color: '#6b6560' }}>
          {member.name}
        </span>
      </div>

      {/* Secret Anomaly Notice (if this member received the whisper frequency) */}
      {isGlitchTarget && (
        <div className="mb-6 flex justify-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#c8a065]/50 bg-[#c8a065]/10 backdrop-blur-sm shadow-[0_0_15px_rgba(200,160,101,0.2)]">
            <span className="text-xs text-[#c8a065] animate-pulse">⚡</span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#c8a065] font-medium">
              Geheime Frequenz · Nur du empfängst diesen Impuls
            </span>
          </div>
        </div>
      )}

      {/* Prompt */}
      <div className="flex-1 flex flex-col justify-center items-center text-center">
        <p
          className="font-display text-2xl md:text-3xl font-light leading-snug animate-fade-up mb-10 text-center"
          style={{ color: '#e8e4de', animationDelay: '150ms' }}
        >
          {displayPrompt}
        </p>

        {/* 1. TEXT */}
        {(wave.prompt_type === 'text' || !wave.prompt_type) && (
          <div className="w-full animate-fade-up" style={{ animationDelay: '300ms' }}>
            <textarea
              autoFocus
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              rows={3}
              maxLength={300}
              className="w-full bg-transparent border-b resize-none py-3 text-center text-lg leading-relaxed focus:outline-none"
              style={{
                borderColor: '#1e1e1e',
                color: '#e8e4de',
                caretColor: '#c8a065',
              }}
              placeholder="..."
            />
          </div>
        )}

        {/* 2. CHOICE / DILEMMA */}
        {wave.prompt_type === 'choice' && choices && (
          <div className="flex flex-col gap-3 w-full animate-fade-up" style={{ animationDelay: '300ms' }}>
            {choices.map((opt, i) => (
              <button
                key={i}
                onClick={() => setSelected(opt)}
                className="text-left py-4 px-5 border transition-all duration-200"
                style={{
                  borderColor: selected === opt ? '#c8a065' : '#1e1e1e',
                  background: selected === opt ? 'rgba(200,160,101,0.08)' : 'transparent',
                  color: selected === opt ? '#e8e4de' : '#6b6560',
                  borderRadius: 2,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* 3. DRAW CANVAS */}
        {wave.prompt_type === 'draw' && (
          <div className="animate-fade-up w-full flex justify-center" style={{ animationDelay: '300ms' }}>
            <DrawCanvas onSave={(dataUrl) => setMediaContent(dataUrl)} />
          </div>
        )}

        {/* 4. PHOTO CAPTURE */}
        {wave.prompt_type === 'photo' && (
          <div className="animate-fade-up w-full flex justify-center" style={{ animationDelay: '300ms' }}>
            <PhotoCapture onPhotoSelected={(dataUrl) => setMediaContent(dataUrl)} />
          </div>
        )}

        {/* 5. SPECTRUM (POLARITÄTEN) */}
        {wave.prompt_type === 'spectrum' && (
          <div className="animate-fade-up w-full flex justify-center" style={{ animationDelay: '300ms' }}>
            <SpectrumSlider
              poleA={choices?.[0] || 'Pol A'}
              poleB={choices?.[1] || 'Pol B'}
              onComplete={(payload) => handleSubmit(payload)}
            />
          </div>
        )}

        {/* 6. PULSE TOUCH (HOLD) */}
        {wave.prompt_type === 'pulse' && (
          <div className="animate-fade-up w-full flex justify-center" style={{ animationDelay: '300ms' }}>
            <PulseTouch onComplete={() => handleSubmit('Resonanz geteilt')} />
          </div>
        )}

        {/* 7. SILENCE MOMENT */}
        {wave.prompt_type === 'silence' && (
          <div className="animate-fade-up w-full flex justify-center" style={{ animationDelay: '300ms' }}>
            <SilenceMoment onComplete={() => handleSubmit('Stille vollzogen')} />
          </div>
        )}

        {/* 8. ENIGMA (KOOPERATIVE FRAGMENT-ANOMALIE) */}
        {wave.prompt_type === 'enigma' && extractEnigma(wave.options) && (
          <div className="animate-fade-up w-full flex justify-center" style={{ animationDelay: '250ms' }}>
            <EnigmaPuzzle
              enigma={extractEnigma(wave.options)!}
              member={member}
              members={members || [member]}
              onSubmit={handleSubmit}
            />
          </div>
        )}

        {/* 9. VIBE SELECTOR (BILD-DILEMMA / VIBE CHECK) */}
        {wave.prompt_type === 'vibe' && vibeOptions && (
          <div className="animate-fade-up w-full flex justify-center" style={{ animationDelay: '250ms' }}>
            <VibeSelector
              items={vibeOptions}
              selectedId={selected}
              onSelect={(item) => setSelected(item.title)}
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-xs text-center mt-3 animate-fade-in">{error}</p>
      )}

      {/* Submit button (nötig für Text, Choice, Draw, Photo, Vibe) */}
      {['text', 'choice', 'draw', 'photo', 'vibe'].includes(wave.prompt_type) && (
        <div className="animate-fade-up mt-8" style={{ animationDelay: '450ms' }}>
          <button
            onClick={handleSubmitClick}
            disabled={
              loading ||
              ((wave.prompt_type === 'choice' || wave.prompt_type === 'vibe') && !selected) ||
              (wave.prompt_type === 'text' && !answer.trim()) ||
              ((wave.prompt_type === 'draw' || wave.prompt_type === 'photo') && !mediaContent)
            }
            className="w-full py-5 text-sm tracking-[0.25em] uppercase transition-opacity hover:opacity-70 disabled:opacity-20 border border-[#c8a065]/40 hover:border-[#c8a065]"
            style={{ color: '#c8a065' }}
          >
            {loading ? '···' : 'Senden →'}
          </button>
        </div>
      )}
    </div>
  )
}
