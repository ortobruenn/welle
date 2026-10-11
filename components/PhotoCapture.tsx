'use client'

import { useRef, useState } from 'react'

interface Props {
  onPhotoSelected: (dataUrl: string) => void
}

export default function PhotoCapture({ onPhotoSelected }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setProcessing(true)
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 600
        let width = img.width
        let height = img.height

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        const compressed = canvas.toDataURL('image/jpeg', 0.75)
        setPreview(compressed)
        onPhotoSelected(compressed)
        setProcessing(false)
      }
      img.onerror = () => {
        setProcessing(false)
      }
      img.src = reader.result as string
    }
    reader.onerror = () => {
      setProcessing(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {processing ? (
        <div className="w-full aspect-square max-w-[280px] border border-[#2a2a2a] rounded flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-[#c8a065] border-t-transparent animate-spin" />
          <span className="text-xs tracking-[0.2em] uppercase text-[#6b6560]">
            Wird verarbeitet...
          </span>
        </div>
      ) : preview ? (
        <div className="relative w-full aspect-square max-w-[280px] rounded overflow-hidden border border-[#c8a065] shadow-2xl">
          <img src={preview} alt="Ausschnitt" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => {
              setPreview(null)
              onPhotoSelected('')
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
            className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm text-xs px-3 py-1.5 rounded text-[#e8e4de] hover:bg-black transition-colors"
          >
            Neues Foto
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full aspect-square max-w-[260px] border border-dashed border-[#2a2a2a] hover:border-[#c8a065] rounded flex flex-col items-center justify-center gap-4 transition-all duration-300 p-6 group cursor-pointer"
        >
          <div className="w-14 h-14 rounded-full border border-[#2a2a2a] group-hover:border-[#c8a065] flex items-center justify-center transition-colors">
            <span className="font-display text-2xl text-[#c8a065]">📷</span>
          </div>
          <span className="text-xs tracking-[0.2em] uppercase text-[#6b6560] group-hover:text-[#e8e4de] text-center transition-colors">
            Foto aufnehmen oder wählen
          </span>
        </button>
      )}
    </div>
  )
}
