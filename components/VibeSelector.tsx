'use client'

import { useState } from 'react'
import type { VibeItem } from '@/lib/mystery'

interface Props {
  items: VibeItem[]
  selectedId: string | null
  onSelect: (item: VibeItem) => void
}

export default function VibeSelector({ items, selectedId, onSelect }: Props) {
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({})
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  const handleImageLoad = (id: string) => {
    setLoadedImages(prev => ({ ...prev, [id]: true }))
  }

  const handleImageError = (id: string) => {
    setFailedImages(prev => ({ ...prev, [id]: true }))
  }

  return (
    <div className={`grid gap-4 w-full ${items.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
      {items.map((item) => {
        const isSelected = selectedId === item.id || selectedId === item.title
        const isLoaded = !!loadedImages[item.id]
        const hasFailed = !!failedImages[item.id]

        return (
          <button
            type="button"
            key={item.id}
            onClick={() => onSelect(item)}
            className={`group relative flex flex-col p-3 rounded-lg border text-left transition-all duration-300 overflow-hidden cursor-pointer ${
              isSelected
                ? 'border-[#c8a065] bg-[#c8a065]/10 shadow-[0_0_25px_rgba(200,160,101,0.2)] ring-1 ring-[#c8a065]'
                : 'border-[#1e1e1e] bg-[#0e0e0e] hover:border-[#c8a065]/50 hover:bg-[#141414]'
            }`}
          >
            {/* Visual Image Container */}
            <div className="relative w-full aspect-square rounded-md overflow-hidden bg-[#161616] mb-3 flex items-center justify-center">
              {/* Fallback card if image cannot be loaded */}
              {hasFailed ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#1c1815] to-[#12100e]">
                  <span className="text-4xl mb-2">🎭</span>
                  <span className="font-display text-sm text-[#e8e4de] line-clamp-2 leading-tight mb-1">{item.title}</span>
                  <span className="text-[10px] tracking-widest uppercase text-[#c8a065]">Vibe {item.id.replace('opt_', '')}</span>
                </div>
              ) : (
                <>
                  {/* Loading Shimmer Skeleton (nur im Hintergrund solange Bild lädt) */}
                  {!isLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#181818] animate-pulse">
                      <span className="text-2xl mb-1 opacity-40">✨</span>
                      <span className="text-[#6b6560] text-[11px] tracking-widest uppercase">Lade Bild...</span>
                    </div>
                  )}

                  {/* Eager image rendering: Kein loading="lazy", damit WebKit nicht blockiert */}
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    loading="eager"
                    decoding="async"
                    onLoad={() => handleImageLoad(item.id)}
                    onError={() => handleImageError(item.id)}
                    ref={(el) => {
                      if (el && el.complete && el.naturalWidth > 0 && !loadedImages[item.id]) {
                        handleImageLoad(item.id)
                      }
                    }}
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                      isLoaded ? 'opacity-100' : 'opacity-90'
                    }`}
                  />
                </>
              )}

              {/* Selection Checkmark Overlay */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#c8a065] text-[#0a0a0a] flex items-center justify-center text-xs font-bold shadow-md z-20">
                  ✓
                </div>
              )}
            </div>

            {/* Label and Info */}
            <div className="flex items-center justify-between px-1">
              <span
                className={`font-display text-base font-medium leading-snug transition-colors ${
                  isSelected ? 'text-[#c8a065]' : 'text-[#e8e4de] group-hover:text-white'
                }`}
              >
                {item.title}
              </span>
              <span
                className={`text-[11px] tracking-wider uppercase transition-colors ${
                  isSelected ? 'text-[#c8a065]' : 'text-[#6b6560]'
                }`}
              >
                {isSelected ? 'Ausgewählt' : 'Tippen'}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
