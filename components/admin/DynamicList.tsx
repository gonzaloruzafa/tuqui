'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'

interface NamedItem {
  name: string
  notes: string
}

interface DynamicListProps {
  label: string
  icon: string
  subtitle: string
  items: NamedItem[]
  fieldName: string
  namePlaceholder?: string
  notesPlaceholder?: string
}

export function DynamicList({
  label, icon, subtitle, items: initial, fieldName,
  namePlaceholder = 'Nombre', notesPlaceholder = 'Notas (opcional)',
}: DynamicListProps) {
  const [items, setItems] = useState<NamedItem[]>(initial.length > 0 ? initial : [])

  const addItem = () => setItems([...items, { name: '', notes: '' }])

  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  const updateItem = (i: number, field: 'name' | 'notes', value: string) => {
    const updated = [...items]
    updated[i] = { ...updated[i], [field]: value }
    setItems(updated)
  }

  return (
    <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50 bg-gray-50/20">
        <h2 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <span>{icon}</span> {label}
        </h2>
        <p className="text-sm text-gray-500 mt-1 italic">{subtitle}</p>
      </div>

      <div className="p-8 space-y-3">
        {/* Hidden field to serialize the list as JSON */}
        <input type="hidden" name={fieldName} value={JSON.stringify(items.filter(i => i.name.trim()))} />

        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 group">
            <input
              value={item.name}
              onChange={e => updateItem(i, 'name', e.target.value)}
              placeholder={namePlaceholder}
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
            />
            <input
              value={item.notes}
              onChange={e => updateItem(i, 'notes', e.target.value)}
              placeholder={notesPlaceholder}
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg active:scale-90 transition-all opacity-0 group-hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addItem}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-adhoc-violet hover:text-adhoc-violet hover:bg-adhoc-lavender/5 transition-all"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>
    </section>
  )
}
