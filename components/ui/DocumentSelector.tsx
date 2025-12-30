'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, FileText, ChevronRight, ChevronDown, FolderOpen, X, Check } from 'lucide-react'

interface Document {
    id: string
    title?: string
    metadata: { filename?: string; category?: string } | null
}

interface DocumentSelectorProps {
    documents: Document[]
    selectedIds: Set<string> | string[]
    name?: string
}

// Categorize documents by folder/type
function categorizeDocuments(docs: Document[]) {
    const categories: Record<string, Document[]> = {
        'fiscal': [],
        'legal': [],
        'empresa': [],
        'otros': []
    }
    
    docs.forEach(doc => {
        const filename = (doc.metadata?.filename || doc.title || '').toLowerCase()
        const category = doc.metadata?.category?.toLowerCase() || ''
        
        if (filename.includes('monotributo') || filename.includes('ganancias') || filename.includes('iva') || filename.includes('afip') || category === 'fiscal') {
            categories['fiscal'].push(doc)
        } else if (filename.includes('ley') || filename.includes('legal') || filename.includes('contrato') || filename.includes('sociedades') || filename.includes('consumidor') || category === 'legal') {
            categories['legal'].push(doc)
        } else if (filename.includes('empresa') || filename.includes('company') || category === 'empresa') {
            categories['empresa'].push(doc)
        } else {
            categories['otros'].push(doc)
        }
    })
    
    return categories
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    'fiscal': { label: 'Documentos Fiscales', icon: '📊', color: 'bg-blue-50 border-blue-200' },
    'legal': { label: 'Documentos Legales', icon: '⚖️', color: 'bg-purple-50 border-purple-200' },
    'empresa': { label: 'Documentos de Empresa', icon: '🏢', color: 'bg-green-50 border-green-200' },
    'otros': { label: 'Otros Documentos', icon: '📄', color: 'bg-gray-50 border-gray-200' },
}

// Helper to convert selectedIds to Set safely
function toSet(ids: Set<string> | string[] | undefined): Set<string> {
    if (!ids) return new Set()
    if (ids instanceof Set) return new Set(ids)
    if (Array.isArray(ids)) return new Set(ids)
    return new Set()
}

export function DocumentSelector({ documents, selectedIds, name = 'doc_ids' }: DocumentSelectorProps) {
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Set<string>>(() => toSet(selectedIds))
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['fiscal', 'legal']))

    // Sync with props when they change
    useEffect(() => {
        setSelected(toSet(selectedIds))
    }, [selectedIds])

    const categorizedDocs = useMemo(() => categorizeDocuments(documents), [documents])
    
    const filteredCategories = useMemo(() => {
        if (!search.trim()) return categorizedDocs
        
        const filtered: Record<string, Document[]> = {}
        Object.entries(categorizedDocs).forEach(([cat, docs]) => {
            const matchingDocs = docs.filter(doc => {
                const filename = (doc.metadata?.filename || doc.id).toLowerCase()
                return filename.includes(search.toLowerCase())
            })
            if (matchingDocs.length > 0) {
                filtered[cat] = matchingDocs
            }
        })
        return filtered
    }, [categorizedDocs, search])

    const toggleDoc = (id: string) => {
        const newSelected = new Set(selected)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelected(newSelected)
    }

    const toggleCategory = (category: string) => {
        const newExpanded = new Set(expandedCategories)
        if (newExpanded.has(category)) {
            newExpanded.delete(category)
        } else {
            newExpanded.add(category)
        }
        setExpandedCategories(newExpanded)
    }

    const selectAllInCategory = (category: string) => {
        const newSelected = new Set(selected)
        const docs = filteredCategories[category] || []
        const allSelected = docs.every(d => newSelected.has(d.id))
        
        docs.forEach(doc => {
            if (allSelected) {
                newSelected.delete(doc.id)
            } else {
                newSelected.add(doc.id)
            }
        })
        setSelected(newSelected)
    }

    const selectedCount = selected.size
    const totalDocs = documents.length

    // Get selected doc names for display
    const selectedDocs = documents.filter(d => selected.has(d.id))
    
    // Helper to get display name
    const getDocName = (doc: Document) => doc.title || doc.metadata?.filename || doc.id.substring(0, 8)

    return (
        <div className="space-y-4">
            {/* Hidden inputs for form submission */}
            {Array.from(selected).map(id => (
                <input key={id} type="hidden" name={name} value={id} />
            ))}

            {/* Search bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar documentos..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none"
                />
                {search && (
                    <button 
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Selected summary */}
            {selectedCount > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-violet-50 rounded-lg border border-violet-100">
                    <span className="text-xs font-medium text-violet-700 mr-1">
                        {selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}:
                    </span>
                    {selectedDocs.slice(0, 3).map(doc => (
                        <span 
                            key={doc.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded text-xs text-gray-700 border border-violet-200"
                        >
                            {getDocName(doc)}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault()
                                    toggleDoc(doc.id)
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                    {selectedCount > 3 && (
                        <span className="text-xs text-violet-600">+{selectedCount - 3} más</span>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault()
                            setSelected(new Set())
                        }}
                        className="ml-auto text-xs text-violet-600 hover:text-violet-800 font-medium"
                    >
                        Limpiar
                    </button>
                </div>
            )}

            {/* Document categories */}
            <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                {Object.entries(filteredCategories).map(([category, docs]) => {
                    if (docs.length === 0) return null
                    
                    const catInfo = CATEGORY_LABELS[category] || CATEGORY_LABELS['otros']
                    const isExpanded = expandedCategories.has(category)
                    const allSelected = docs.every(d => selected.has(d.id))
                    const someSelected = docs.some(d => selected.has(d.id))
                    const selectedInCat = docs.filter(d => selected.has(d.id)).length
                    
                    return (
                        <div key={category}>
                            {/* Category header */}
                            <div 
                                className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${catInfo.color} sticky top-0 z-10`}
                                onClick={(e) => {
                                    e.preventDefault()
                                    toggleCategory(category)
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                    )}
                                    <span className="text-lg">{catInfo.icon}</span>
                                    <span className="font-medium text-gray-800 text-sm">{catInfo.label}</span>
                                    <span className="text-xs text-gray-500 bg-white/60 px-2 py-0.5 rounded-full">
                                        {selectedInCat > 0 ? `${selectedInCat}/${docs.length}` : docs.length}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        selectAllInCategory(category)
                                    }}
                                    className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${
                                        allSelected 
                                            ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                                            : someSelected
                                                ? 'bg-violet-50 text-violet-600 hover:bg-violet-100'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
                                </button>
                            </div>
                            
                            {/* Documents in category */}
                            {isExpanded && (
                                <div className="bg-white divide-y divide-gray-50">
                                    {docs.map(doc => {
                                        const isSelected = selected.has(doc.id)
                                        const docName = getDocName(doc)
                                        return (
                                            <div
                                                key={doc.id}
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    toggleDoc(doc.id)
                                                }}
                                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-l-2 ${
                                                    isSelected ? 'border-l-violet-500 bg-violet-50/50' : 'border-l-transparent'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                    isSelected 
                                                        ? 'bg-violet-600 border-violet-600' 
                                                        : 'border-gray-300 hover:border-violet-400'
                                                }`}>
                                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <FileText className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-violet-500' : 'text-gray-400'}`} />
                                                <span className={`text-sm truncate ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                                                    {docName}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Empty state */}
                {Object.values(filteredCategories).every(docs => docs.length === 0) && (
                    <div className="p-8 text-center">
                        <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">
                            {documents.length === 0 
                                ? 'No hay documentos cargados en el sistema'
                                : 'No se encontraron documentos que coincidan con la búsqueda'}
                        </p>
                    </div>
                )}
            </div>

            {/* Footer stats */}
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span>{totalDocs} documento{totalDocs !== 1 ? 's' : ''} disponible{totalDocs !== 1 ? 's' : ''}</span>
                <span>{selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}</span>
            </div>
        </div>
    )
}
