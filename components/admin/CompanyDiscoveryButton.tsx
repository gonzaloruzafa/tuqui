'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { runCompanyDiscovery } from '@/app/admin/company/actions'

/** Custom event name for auto-filling form fields */
export const AUTOFILL_EVENT = 'tuqui:autofill'

export function CompanyDiscoveryButton() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDiscovery = () => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await runCompanyDiscovery()
        if (result.success && result.data) {
          // Dispatch custom events for each field — DictationTextarea and inputs listen for these
          for (const [name, value] of Object.entries(result.data)) {
            if (typeof value === 'string' && value) {
              window.dispatchEvent(new CustomEvent(AUTOFILL_EVENT, { detail: { name, value } }))
            }
          }
        } else {
          setError(result.error || 'Error desconocido')
        }
      } catch (e) {
        console.error('[Discovery] Client error:', e)
        setError('Error inesperado al conectar con Odoo')
      }
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDiscovery}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-adhoc-violet to-purple-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {isPending ? 'Analizando Odoo...' : 'Detectar desde Odoo'}
      </button>
      {isPending && (
        <p className="text-xs text-gray-400 mt-2">Consultando ventas, clientes, productos...</p>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}
    </div>
  )
}
