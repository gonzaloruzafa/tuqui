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
  const accumulatedRef = useRef('')  // finalized text across restarts
  const recordingRef = useRef(false) // track recording state for onend handler

  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) return

    setIsSupported(true)

    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)

    const rec = new SpeechRecognition()
    rec.lang = lang
    rec.continuous = !isMobile      // mobile: false to avoid duplication
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
      // On mobile (non-continuous), finalized text resets per segment
      // so we accumulate across restarts
      const full = (accumulatedRef.current + finalText + interimText).trim()
      setTranscript(full)
      transcriptRef.current = full

      // When a segment finalizes on mobile, save it to accumulated
      if (isMobile && finalText) {
        accumulatedRef.current = (accumulatedRef.current + finalText).trim() + ' '
      }
    }

    rec.onerror = (event: any) => {
      // 'no-speech' is normal on mobile when user pauses — don't stop
      if (event.error === 'no-speech') return
      console.error('[Dictation] Error:', event.error)
      setIsRecording(false)
      recordingRef.current = false
    }

    rec.onend = () => {
      // On mobile, recognition auto-stops after each phrase.
      // Restart if still recording.
      if (recordingRef.current && isMobile) {
        try { rec.start() } catch { /* ignore */ }
      }
    }

    recognitionRef.current = rec

    return () => {
      recordingRef.current = false
      try { rec.stop() } catch {}
    }
  }, [lang])

  const start = useCallback(async () => {
    const rec = recognitionRef.current
    if (!rec) return

    setTranscript('')
    transcriptRef.current = ''
    accumulatedRef.current = ''

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      recordingRef.current = true
      rec.start()
      setIsRecording(true)
    } catch (err) {
      console.error('[Dictation] Mic permission denied:', err)
    }
  }, [])

  const cancel = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    recordingRef.current = false
    rec.stop()
    setTranscript('')
    transcriptRef.current = ''
    accumulatedRef.current = ''
    setIsRecording(false)
  }, [])

  const confirm = useCallback(() => {
    const rec = recognitionRef.current
    recordingRef.current = false
    if (rec) rec.stop()

    const final = transcriptRef.current.trim()
    setTranscript('')
    transcriptRef.current = ''
    accumulatedRef.current = ''
    setIsRecording(false)
    return final
  }, [])

  return { isRecording, transcript, isSupported, start, cancel, confirm }
}
