'use client'

import { useState } from 'react'
import type { Wave, Member } from '@/lib/types'
import DrawCanvas from './DrawCanvas'
import PhotoCapture from './PhotoCapture'
import PulseTouch from './PulseTouch'
import SilenceMoment from './SilenceMoment'

interface Props {
  wave: Wave
  member: Member
  onSubmit: (content: string) => Promise<void>
}

export default function WaveScreen({ wave, member, onSubmit }: Props) {
  const [answer, setAnswer] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [mediaContent, setMediaContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (overrideContent?: string) => {
    let content = overrideContent

    if (!content) {
      if (wave.prompt_type === 'choice') content = selected || ''
      else if (wave.prompt_type === 'draw' || wave.prompt_type === 'photo') content = mediaContent
      else content = answer.trim()
    }

    if (!content) return
    setLoading(true)
    await onSubmit(content)
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: '#0a0a0a' }}
      >
        <div className="animate-scale-in text-4xl mb-6" style={{ color: '#c8a065' }}>∿</div>
        <p className="text-sm tracking-[0.2em] uppercase animate-fade-up" style={{ color: '#6b6560' }}>
          erfasst
        </p>
      </div>
    )
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

      {/* Prompt */}
      <div className="flex-1 flex flex-col justify-center items-center text-center">
        <p
          className="font-display text-2xl md:text-3xl font-light leading-snug animate-fade-up mb-10 text-center"
          style={{ color: '#e8e4de', animationDelay: '150ms' }}
        >
          {wave.prompt}
        </p>

        {/* 1. TEXT / MONO-WORT / CHAIN */}
        {(wave.prompt_type === 'text' || wave.prompt_type === 'chain' || !wave.prompt_type) && (
          <div className="w-full animate-fade-up" style={{ animationDelay: '300ms' }}>
            <textarea
              autoFocus
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              rows={wave.prompt_type === 'chain' ? 1 : 3}
              maxLength={wave.prompt_type === 'chain' ? 40 : 300}
              className="w-full bg-transparent border-b resize-none py-3 text-center text-lg leading-relaxed focus:outline-none"
              style={{
                borderColor: '#1e1e1e',
                color: '#e8e4de',
                caretColor: '#c8a065',
              }}
              placeholder={wave.prompt_type === 'chain' ? 'Ein einziges Wort...' : '...'}
            />
          </div>
        )}

        {/* 2. CHOICE / DILEMMA */}
        {wave.prompt_type === 'choice' && wave.options && (
          <div className="flex flex-col gap-3 w-full animate-fade-up" style={{ animationDelay: '300ms' }}>
            {wave.options.map((opt, i) => (
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

        {/* 5. PULSE TOUCH (HOLD) */}
        {wave.prompt_type === 'pulse' && (
          <div className="animate-fade-up w-full flex justify-center" style={{ animationDelay: '300ms' }}>
            <PulseTouch onComplete={() => handleSubmit('Resonanz geteilt')} />
          </div>
        )}

        {/* 6. SILENCE MOMENT */}
        {wave.prompt_type === 'silence' && (
          <div className="animate-fade-up w-full flex justify-center" style={{ animationDelay: '300ms' }}>
            <SilenceMoment onComplete={() => handleSubmit('Stille vollzogen')} />
          </div>
        )}
      </div>

      {/* Submit button (nur nötig für Text, Choice, Draw, Photo) */}
      {['text', 'choice', 'draw', 'photo', 'chain'].includes(wave.prompt_type) && (
        <div className="animate-fade-up mt-8" style={{ animationDelay: '450ms' }}>
          <button
            onClick={() => handleSubmit()}
            disabled={
              loading ||
              (wave.prompt_type === 'choice' && !selected) ||
              ((wave.prompt_type === 'text' || wave.prompt_type === 'chain') && !answer.trim()) ||
              ((wave.prompt_type === 'draw' || wave.prompt_type === 'photo') && !mediaContent)
            }
            className="w-full py-5 text-sm tracking-[0.25em] uppercase transition-opacity hover:opacity-70 disabled:opacity-20"
            style={{ color: '#c8a065' }}
          >
            {loading ? '···' : 'Senden →'}
          </button>
        </div>
      )}
    </div>
  )
}
