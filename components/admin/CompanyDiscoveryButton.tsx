'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'

/** Custom event name for auto-filling form fields */
export const AUTOFILL_EVENT = 'tuqui:autofill'

interface Progress {
  completed: number
  total: number
  currentLabel: string
  phase: 'querying' | 'synthesizing' | 'done'
}

export function CompanyDiscoveryButton() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDiscovery = async () => {
    setError(null)
    setRunning(true)
    setProgress({ completed: 0, total: 1, currentLabel: 'Conectando con Odoo...', phase: 'querying' })

    try {
      const res = await fetch('/api/admin/discover')
      if (!res.ok || !res.body) {
        setError('Error al conectar con el servidor')
        setRunning(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))

            if (currentEvent === 'progress') {
              setProgress(data)
            } else if (currentEvent === 'result') {
              if (data.success && data.data) {
                dispatchAutofill(data.data)
              } else {
                setError(data.error || 'Error desconocido')
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('[Discovery] Client error:', e)
      setError('Error inesperado al conectar con Odoo')
    } finally {
      setRunning(false)
      // Keep progress visible briefly then clear
      setTimeout(() => setProgress(null), 2000)
    }
  }

  const pct = progress
    ? progress.phase === 'synthesizing' ? 95
    : progress.phase === 'done' ? 100
    : Math.round((progress.completed / Math.max(progress.total, 1)) * 90)
    : 0

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleDiscovery}
        disabled={running}
        className="relative w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-adhoc-violet to-purple-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:cursor-not-allowed shadow-sm overflow-hidden"
      >
        {/* Progress fill */}
        {running && (
          <div
            className="absolute inset-0 bg-white/20 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        )}
        <span className="relative flex items-center gap-2">
          {running ? (
            <Sparkles className="w-4 h-4 animate-pulse" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {running
            ? progress?.phase === 'synthesizing'
              ? 'Sintetizando con IA...'
              : progress?.phase === 'done'
                ? '¡Listo!'
                : `Analizando Odoo... ${pct}%`
            : 'Detectar desde Odoo'
          }
        </span>
      </button>
      {running && progress && progress.phase !== 'done' && (
        <p className="text-xs text-gray-400 mt-2 truncate animate-pulse">
          {progress.currentLabel}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}
    </div>
  )
}

/** Dispatch autofill events for all fields including toneOfVoice */
function dispatchAutofill(data: Record<string, unknown>) {
  const fieldMap: Record<string, string> = {
    topCustomers: 'key_customers',
    topProducts: 'key_products',
    topSuppliers: 'key_suppliers',
    toneOfVoice: 'tone_of_voice',
  }

  for (const [key, value] of Object.entries(data)) {
    const name = fieldMap[key] || key
    if (value && (typeof value === 'string' || Array.isArray(value))) {
      window.dispatchEvent(new CustomEvent(AUTOFILL_EVENT, { detail: { name, value } }))
    }
  }
}
