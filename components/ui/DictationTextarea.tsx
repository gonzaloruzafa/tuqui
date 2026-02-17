'use client'

import { useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { useDictation } from '@/lib/hooks/useDictation'

interface DictationTextareaProps {
  name: string
  defaultValue?: string
  placeholder?: string
  rows?: number
  className?: string
}

/**
 * Textarea with dictation 🎤 button.
 * Reusable for any form field that needs speech-to-text.
 */
export function DictationTextarea({
  name,
  defaultValue = '',
  placeholder,
  rows = 3,
  className,
}: DictationTextareaProps) {
  const [value, setValue] = useState(defaultValue)
  const dictation = useDictation()

  const handleDictation = () => {
    if (dictation.isRecording) {
      const text = dictation.confirm()
      if (text) {
        setValue(prev => prev ? `${prev} ${text}` : text)
      }
    } else {
      dictation.start()
    }
  }

  return (
    <div>
      <div className="relative">
        <textarea
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={className || 'w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm resize-none focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all'}
        />
        {dictation.isSupported && (
          <button
            type="button"
            onClick={handleDictation}
            className={`absolute top-3 right-3 p-1.5 rounded-lg transition-colors ${
              dictation.isRecording
                ? 'bg-red-50 text-red-500 hover:bg-red-100'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
            }`}
            title={dictation.isRecording ? 'Parar dictado' : 'Dictar'}
          >
            {dictation.isRecording ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
      {dictation.isRecording && dictation.transcript && (
        <div className="mt-1.5 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 animate-pulse">
          🎤 {dictation.transcript}
        </div>
      )}
    </div>
  )
}
