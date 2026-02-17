'use client'

import { useState, useEffect } from 'react'
import { Building } from 'lucide-react'
import { AUTOFILL_EVENT } from '@/components/admin/CompanyDiscoveryButton'

interface AutofillInputProps {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  type?: string
}

/**
 * Input field that listens for autofill events.
 * Use for fields that need to be auto-filled by CompanyDiscoveryButton.
 */
export function AutofillInput({
  label,
  name,
  defaultValue = '',
  placeholder,
  type = 'text',
}: AutofillInputProps) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const handler = (e: Event) => {
      const { name: fieldName, value: fieldValue } = (e as CustomEvent).detail
      if (fieldName === name) setValue(fieldValue)
    }
    window.addEventListener(AUTOFILL_EVENT, handler)
    return () => window.removeEventListener(AUTOFILL_EVENT, handler)
  }, [name])

  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</label>
      <div className="relative">
        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
        <input
          name={name}
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
        />
      </div>
    </div>
  )
}
