'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'

interface RulesListProps {
  rules: string[]
  fieldName: string
}

export function RulesList({ rules: initial, fieldName }: RulesListProps) {
  const [rules, setRules] = useState<string[]>(initial.length > 0 ? initial : [])

  const addRule = () => setRules([...rules, ''])
  const removeRule = (i: number) => setRules(rules.filter((_, idx) => idx !== i))
  const updateRule = (i: number, value: string) => {
    const updated = [...rules]
    updated[i] = value
    setRules(updated)
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={fieldName} value={JSON.stringify(rules.filter(r => r.trim()))} />

      {rules.map((rule, i) => (
        <div key={i} className="flex items-center gap-3 group">
          <span className="text-xs font-bold text-gray-300 w-6 text-right">{i + 1}.</span>
          <input
            value={rule}
            onChange={e => updateRule(i, e.target.value)}
            placeholder="Ej: Margen mínimo 30%"
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
          />
          <button
            type="button"
            onClick={() => removeRule(i)}
            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg active:scale-90 transition-all opacity-0 group-hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRule}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-adhoc-violet hover:text-adhoc-violet hover:bg-adhoc-lavender/5 transition-all"
      >
        <Plus className="w-4 h-4" />
        Agregar regla
      </button>
    </div>
  )
}
