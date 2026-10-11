'use client'

import { useState } from 'react'
import type { Member } from '@/lib/types'
import type { EnigmaData } from '@/lib/mystery'

interface Props {
  enigma: EnigmaData
  member: Member
  members: Member[]
  onSubmit: (content: string) => Promise<void>
}

export default function EnigmaPuzzle({ enigma, member, members, onSubmit }: Props) {
  const [guess, setGuess] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Sort members deterministically to give each person their unique fragment
  const sortedMembers = [...members].sort((a, b) => a.id.localeCompare(b.id))
  const myIndex = sortedMembers.findIndex(m => m.id === member.id)
  const fragmentIndex = myIndex >= 0 ? myIndex % enigma.fragments.length : 0
  const myFragment = enigma.fragments[fragmentIndex] || enigma.fragments[0] || '...'
  const totalFragments = enigma.fragments.length

  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI']
  const romanIndex = romanNumerals[fragmentIndex] || `${fragmentIndex + 1}`

  const handleSubmit = async () => {
    const cleanGuess = guess.trim().toUpperCase()
    if (!cleanGuess) return

    if (cleanGuess === enigma.solution) {
      setError(null)
      setSuccess(true)
      setSubmitting(true)
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate?.([80, 50, 100]) } catch {}
      }
      try {
        await onSubmit(`Entschlüsselt: ${enigma.solution}`)
      } catch (err) {
        console.error('Failed to submit enigma resolution:', err)
        setError('Übertragung fehlgeschlagen. Bitte erneut versuchen.')
        setSubmitting(false)
        setSuccess(false)
      }
    } else {
      setError('Das Siegel regt sich nicht. Das Wort ist unvollständig oder falsch.')
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate?.([40, 40]) } catch {}
      }
      setTimeout(() => setError(null), 3500)
    }
  }

  return (
    <div className="w-full flex flex-col items-center animate-fade-up">
      {/* Ancient Runic Tablet Container */}
      <div className="w-full p-6 md:p-8 rounded-sm border border-[#2a2318] bg-[#0e0c08] shadow-[0_0_40px_rgba(200,160,101,0.06)] relative overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#c8a065]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Fragment Badge */}
        <div className="flex items-center justify-between mb-4 border-b border-[#231d14] pb-3">
          <div className="inline-flex items-center gap-2">
            <span className="text-xs text-[#c8a065] animate-pulse">✦</span>
            <span className="text-[11px] tracking-[0.25em] uppercase text-[#c8a065] font-semibold">
              Fragment {romanIndex} von {totalFragments}
            </span>
          </div>
          <span className="text-[10px] tracking-widest uppercase text-[#736a5c]">
            Kooperative Anomalie
          </span>
        </div>

        {/* The Secret Fragment Inscription */}
        <div className="my-6 text-center px-2">
          <p className="font-display text-xl md:text-2xl text-[#f3ede4] leading-relaxed italic">
            „{myFragment}“
          </p>
        </div>

        {/* Cooperative Notice */}
        <div className="pt-4 border-t border-[#231d14] text-center">
          <p className="text-xs text-[#8c8273] leading-relaxed">
            Du hältst nur einen Teil des Siegels. Die anderen Fragmente liegen bei deinen Gefährten.{' '}
            <span className="text-[#c8a065] font-medium">Tauscht euch aus</span>, setzt die Zeilen zusammen und findet das gemeinsame Lösungswort.
          </p>
        </div>
      </div>

      {/* Oracle Hint Toggle */}
      {enigma.hint && (
        <div className="mb-6 text-center">
          {!showHint ? (
            <button
              onClick={() => setShowHint(true)}
              className="text-[11px] tracking-[0.2em] uppercase text-[#736a5c] hover:text-[#c8a065] transition-colors"
            >
              👁 Orakel-Hinweis erbitten
            </button>
          ) : (
            <div className="p-3 bg-[#12100c] border border-[#231d14] rounded text-xs text-[#c8a065] italic animate-fade-in max-w-sm">
              Tipp: {enigma.hint}
            </div>
          )}
        </div>
      )}

      {/* Solution Cipher Input */}
      <div className="w-full max-w-xs flex flex-col gap-4">
        <div className="relative">
          <input
            autoFocus
            type="text"
            value={guess}
            onChange={e => setGuess(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && !submitting && handleSubmit()}
            disabled={submitting || success}
            placeholder="LÖSUNGSWORT..."
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] focus:border-[#c8a065] py-3.5 px-4 text-center tracking-[0.3em] font-display text-lg uppercase text-[#e8e4de] focus:outline-none transition-all placeholder:tracking-widest placeholder:text-[#444] rounded-sm caret-[#c8a065]"
          />
          {success && (
            <div className="absolute inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm flex items-center justify-center border border-[#c8a065] rounded-sm animate-fade-in">
              <span className="text-xs tracking-[0.25em] uppercase text-[#c8a065] font-medium">
                ✓ Siegel gebrochen
              </span>
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center animate-fade-in leading-relaxed">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !guess.trim() || success}
          className="w-full py-4 text-xs tracking-[0.3em] uppercase border border-[#c8a065] text-[#c8a065] hover:bg-[#c8a065]/10 disabled:opacity-25 transition-all shadow-[0_0_15px_rgba(200,160,101,0.1)] font-medium"
        >
          {submitting ? '···' : 'Siegel lösen →'}
        </button>
      </div>
    </div>
  )
}
