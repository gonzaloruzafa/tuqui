'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  const handleDiscovery = async () => {
    setError(null)
    setDone(false)
    setRunning(true)
    setLog(['Conectando con Odoo...'])

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
              const p = data as Progress
              setLog(prev => {
                const next = [...prev, `[${p.completed}/${p.total}] ${p.currentLabel}`]
                return next.slice(-20) // keep last 20 entries
              })
              // Auto-scroll log
              setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50)
            } else if (currentEvent === 'result') {
              if (data.success) {
                setDone(true)
                setLog(prev => [...prev, '✓ Guardado. Recargando...'])
                setTimeout(() => router.refresh(), 500)
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
    }
  }

  return (
    <div className="shrink-0 w-56">
      <button
        type="button"
        onClick={handleDiscovery}
        disabled={running}
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-adhoc-violet text-white rounded-xl text-sm font-semibold hover:bg-adhoc-violet/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm whitespace-nowrap"
      >
        <Sparkles className={`w-4 h-4 ${running ? 'animate-pulse' : ''}`} />
        {running ? 'Analizando Odoo...' : done ? '✓ Detectado' : 'Detectar desde Odoo'}
      </button>
      {log.length > 0 && (running || done) && (
        <div
          ref={logRef}
          className="mt-2 max-h-28 overflow-y-auto rounded-lg bg-gray-50 border border-gray-100 p-2 space-y-0.5"
        >
          {log.map((entry, i) => (
            <p key={i} className="text-[11px] text-gray-400 truncate font-mono">
              {entry}
            </p>
          ))}
        </div>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-2 truncate">{error}</p>
      )}
    </div>
  )
}
