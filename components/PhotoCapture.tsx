'use client'

import { useRef, useState } from 'react'

interface Props {
  onPhotoSelected: (dataUrl: string) => void
}

export default function PhotoCapture({ onPhotoSelected }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        // Skaliere das Bild auf kompakte Größe (z.B. max 600px)
        const canvas = document.createElement('canvas')
        const maxDim = 600
        let width = img.width
        let height = img.height

        if (width > height && width > maxDim) {
          height = (height * maxDim) / width
          width = maxDim
        } else if (height > maxDim) {
          width = (width * maxDim) / height
          height = maxDim
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        const compressed = canvas.toDataURL('image/jpeg', 0.75)
        setPreview(compressed)
        onPhotoSelected(compressed)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {preview ? (
        <div className="relative w-full aspect-square max-w-[280px] rounded overflow-hidden border border-[#c8a065]">
          <img src={preview} alt="Ausschnitt" className="w-full h-full object-cover" />
          <button
            onClick={() => {
              setPreview(null)
              onPhotoSelected('')
            }}
            className="absolute top-2 right-2 bg-black/70 text-xs px-2 py-1 rounded text-[#e8e4de]"
          >
            Ändern
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full aspect-square max-w-[260px] border border-dashed border-[#2a2a2a] hover:border-[#c8a065] rounded flex flex-col items-center justify-center gap-3 transition-colors p-6"
        >
          <span className="font-display text-4xl text-[#c8a065]">∿</span>
          <span className="text-xs tracking-[0.2em] uppercase text-[#6b6560] text-center">
            Kamera öffnen oder Bild wählen
          </span>
        </button>
      )}
    </div>
  )
}
