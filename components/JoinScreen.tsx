'use client'

import { useState } from 'react'

interface Props {
  onJoin: (name: string) => Promise<void>
}

const INVITE_CODE = process.env.NEXT_PUBLIC_INVITE_CODE || 'welle'

export default function JoinScreen({ onJoin }: Props) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'name' | 'code'>('name')

  const handleNameSubmit = () => {
    if (name.trim().length < 2) {
      setError('Mindestens 2 Zeichen.')
      return
    }
    setError('')
    setStep('code')
  }

  const handleCodeSubmit = async () => {
    if (code.toLowerCase().trim() !== INVITE_CODE.toLowerCase()) {
      setError('Falscher Code.')
      return
    }
    setError('')
    setLoading(true)
    await onJoin(name.trim())
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8"
      style={{ background: '#0a0a0a' }}
    >
      {/* Symbol */}
      <div
        className="font-display text-5xl font-light mb-16 animate-fade-in"
        style={{ color: '#c8a065' }}
      >
        ∿
      </div>

      {step === 'name' ? (
        <div className="w-full max-w-xs flex flex-col gap-8 animate-fade-up">
          <div className="flex flex-col gap-2">
            <label
              className="text-xs tracking-[0.25em] uppercase"
              style={{ color: '#6b6560' }}
            >
              Dein Name
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
              maxLength={20}
              className="border-b py-3 text-lg bg-transparent focus:outline-none w-full"
              style={{
                borderColor: '#1e1e1e',
                color: '#e8e4de',
                caretColor: '#c8a065',
              }}
              placeholder="..."
            />
            {error && (
              <p className="text-xs" style={{ color: '#c8a065' }}>{error}</p>
            )}
          </div>

          <button
            onClick={handleNameSubmit}
            className="text-sm tracking-[0.2em] uppercase py-4 transition-opacity hover:opacity-70"
            style={{ color: '#c8a065' }}
          >
            Weiter →
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xs flex flex-col gap-8 animate-fade-up">
          <div className="flex flex-col gap-2">
            <label
              className="text-xs tracking-[0.25em] uppercase"
              style={{ color: '#6b6560' }}
            >
              Zugangscode
            </label>
            <input
              autoFocus
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCodeSubmit()}
              className="border-b py-3 text-lg bg-transparent focus:outline-none w-full tracking-widest"
              style={{
                borderColor: '#1e1e1e',
                color: '#e8e4de',
                caretColor: '#c8a065',
              }}
              placeholder="···"
            />
            {error && (
              <p className="text-xs" style={{ color: '#c8a065' }}>{error}</p>
            )}
          </div>

          <div className="flex gap-6">
            <button
              onClick={() => { setStep('name'); setError('') }}
              className="text-sm tracking-[0.2em] uppercase py-4 transition-opacity hover:opacity-70"
              style={{ color: '#6b6560' }}
            >
              ← Zurück
            </button>
            <button
              onClick={handleCodeSubmit}
              disabled={loading}
              className="text-sm tracking-[0.2em] uppercase py-4 transition-opacity hover:opacity-70 disabled:opacity-30"
              style={{ color: '#c8a065' }}
            >
              {loading ? '···' : 'Eintreten →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
