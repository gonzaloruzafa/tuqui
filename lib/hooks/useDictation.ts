'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface UseDictationReturn {
  isRecording: boolean
  transcript: string
  isSupported: boolean
  start: () => Promise<void>
  cancel: () => void
  confirm: () => string
}

/**
 * Hook reutilizable para dictado por voz (Speech-to-Text).
 * Usa Web Speech API (SpeechRecognition).
 * 
 * USAR CUANDO: cualquier textarea/input que necesite dictado
 * (chat, onboarding, notas, etc.)
 * 
 * @param lang - Idioma (default: 'es-AR')
 * @returns { isRecording, transcript, isSupported, start, cancel, confirm }
 * 
 * confirm() retorna el texto final y resetea el estado.
 */
export function useDictation(lang = 'es-AR'): UseDictationReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) return

    setIsSupported(true)

    const rec = new SpeechRecognition()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }
      const full = (finalText + interimText).trim()
      setTranscript(full)
      transcriptRef.current = full
    }

    rec.onerror = (event: any) => {
      console.error('[Dictation] Error:', event.error)
      setIsRecording(false)
    }

    rec.onend = () => {
      // On mobile, recognition may auto-stop. Don't clear transcript.
    }

    recognitionRef.current = rec

    return () => {
      try { rec.stop() } catch {}
    }
  }, [lang])

  const start = useCallback(async () => {
    const rec = recognitionRef.current
    if (!rec) return

    setTranscript('')
    transcriptRef.current = ''

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      rec.start()
      setIsRecording(true)
    } catch (err) {
      console.error('[Dictation] Mic permission denied:', err)
    }
  }, [])

  const cancel = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    rec.stop()
    setTranscript('')
    transcriptRef.current = ''
    setIsRecording(false)
  }, [])

  const confirm = useCallback(() => {
    const rec = recognitionRef.current
    if (rec) rec.stop()

    const final = transcriptRef.current.trim()
    setTranscript('')
    transcriptRef.current = ''
    setIsRecording(false)
    return final
  }, [])

  return { isRecording, transcript, isSupported, start, cancel, confirm }
}
