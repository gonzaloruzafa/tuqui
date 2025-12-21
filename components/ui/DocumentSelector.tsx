'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, FileText, Check } from 'lucide-react'

interface Document {
    id: string
    metadata: { filename?: string } | null
}

interface DocumentSelectorProps {
    documents: Document[]
    selectedIds: Set<string>
    name?: string
}

export function DocumentSelector({ documents, selectedIds, name = 'doc_ids' }: DocumentSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds))
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filteredDocs = documents.filter(doc => {
        const name = (doc.metadata?.filename || doc.id).toLowerCase()
        return name.includes(search.toLowerCase())
    })

    const toggleDoc = (id: string) => {
        const newSelected = new Set(selected)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelected(newSelected)
    }

    const selectedCount = selected.size

    return (
        <div ref={dropdownRef} className="relative">
            {/* Hidden inputs for form submission */}
            {Array.from(selected).map(id => (
                <input key={id} type="hidden" name={name} value={id} />
            ))}

            {/* Trigger button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-adhoc-violet focus:outline-none"
            >
                <div className="flex items-center gap-2 text-left">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className={selectedCount > 0 ? 'text-gray-900' : 'text-gray-500'}>
                        {selectedCount > 0 
                            ? `${selectedCount} documento${selectedCount > 1 ? 's' : ''} seleccionado${selectedCount > 1 ? 's' : ''}`
                            : 'Seleccionar documentos...'}
                    </span>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {/* Search */}
                    <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar documentos..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-adhoc-violet focus:outline-none"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Document list */}
                    <div className="max-h-60 overflow-y-auto">
                        {filteredDocs.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-400">
                                {documents.length === 0 
                                    ? 'No hay documentos cargados'
                                    : 'No se encontraron documentos'}
                            </div>
                        ) : (
                            filteredDocs.map(doc => {
                                const isSelected = selected.has(doc.id)
                                const filename = doc.metadata?.filename || doc.id
                                return (
                                    <button
                                        key={doc.id}
                                        type="button"
                                        onClick={() => toggleDoc(doc.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                                            isSelected ? 'bg-adhoc-lavender/20' : ''
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                            isSelected 
                                                ? 'bg-adhoc-violet border-adhoc-violet' 
                                                : 'border-gray-300'
                                        }`}>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                        <span className="text-sm text-gray-700 truncate flex-1">
                                            {filename}
                                        </span>
                                    </button>
                                )
                            })
                        )}
                    </div>

                    {/* Footer with count */}
                    {selectedCount > 0 && (
                        <div className="p-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                                {selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelected(new Set())}
                                className="text-xs text-adhoc-violet hover:underline"
                            >
                                Deseleccionar todos
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
