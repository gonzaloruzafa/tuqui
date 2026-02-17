'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { runCompanyDiscovery } from '@/app/admin/company/actions'

export function CompanyDiscoveryButton() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDiscovery = () => {
    setError(null)
    startTransition(async () => {
      const result = await runCompanyDiscovery()
      if (result.success && result.data) {
        fillFormField('industry', result.data.industry)
        fillFormField('description', result.data.description)
      } else {
        setError(result.error || 'Error desconocido')
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

/** Fill a native form field by name (for server-rendered inputs) */
function fillFormField(name: string, value: string) {
  const el = document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement | null
  if (el && value) {
    // Trigger React-compatible value setter
    const nativeInput = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )
    nativeInput?.set?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
}
