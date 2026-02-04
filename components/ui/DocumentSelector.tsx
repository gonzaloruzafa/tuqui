'use client'

import { useState, useMemo } from 'react'
import { Search, FileText, ChevronRight, ChevronDown, FolderOpen, X, Check } from 'lucide-react'

interface Document {
    id: string
    title?: string
    metadata: { filename?: string; category?: string } | null
}

interface DocumentSelectorProps {
    documents: Document[]
    selectedIds: string[]  // Must be Array (Sets don't serialize in RSC)
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
    'fiscal': { label: 'Documentos Fiscales', icon: '📊', color: 'bg-blue-50/80 border-blue-100' },
    'legal': { label: 'Documentos Legales', icon: '⚖️', color: 'bg-purple-50/80 border-purple-100' },
    'empresa': { label: 'Documentos de Empresa', icon: '🏢', color: 'bg-green-50/80 border-green-100' },
    'otros': { label: 'Otros Documentos', icon: '📄', color: 'bg-gray-50/80 border-gray-100' },
}

// Helper to convert selectedIds array to Set for internal state
function toSet(ids: string[] | undefined): Set<string> {
    return new Set(ids || [])
}

export function DocumentSelector({ documents, selectedIds, name = 'doc_ids' }: DocumentSelectorProps) {
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Set<string>>(() => toSet(selectedIds))
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['fiscal', 'legal', 'empresa', 'otros']))

    // Note: We intentionally don't sync with props after mount
    // because the user may be editing the selection locally
    // The initial state from useState is sufficient

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
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar documentos..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet focus:outline-none focus:bg-white transition-all"
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
                <div className="flex flex-wrap gap-2 p-4 bg-adhoc-lavender/10 rounded-xl border border-adhoc-lavender/20">
                    <span className="text-sm font-medium text-adhoc-violet mr-1">
                        {selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}:
                    </span>
                    {selectedDocs.slice(0, 3).map(doc => (
                        <span 
                            key={doc.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg text-sm text-gray-700 border border-adhoc-lavender/30 shadow-sm"
                        >
                            <FileText className="w-3 h-3 text-adhoc-violet" />
                            {getDocName(doc)}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault()
                                    toggleDoc(doc.id)
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </span>
                    ))}
                    {selectedCount > 3 && (
                        <span className="text-sm text-adhoc-violet font-medium px-2 py-1">+{selectedCount - 3} más</span>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault()
                            setSelected(new Set())
                        }}
                        className="ml-auto text-sm text-adhoc-violet hover:text-adhoc-violet/70 font-medium transition-colors"
                    >
                        Limpiar todo
                    </button>
                </div>
            )}

            {/* Document list */}
            {(() => {
                // Count how many categories have documents
                const nonEmptyCategories = Object.entries(filteredCategories).filter(([, docs]) => docs.length > 0)
                const showCategoryHeaders = nonEmptyCategories.length > 1
                
                return (
                    <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-[220px] overflow-y-auto bg-white">
                        {nonEmptyCategories.map(([category, docs]) => {
                            const catInfo = CATEGORY_LABELS[category] || CATEGORY_LABELS['otros']
                            const isExpanded = expandedCategories.has(category)
                            const allSelected = docs.every(d => selected.has(d.id))
                            const someSelected = docs.some(d => selected.has(d.id))
                            const selectedInCat = docs.filter(d => selected.has(d.id)).length
                            
                            return (
                                <div key={category}>
                                    {/* Category header - only show if multiple categories */}
                                    {showCategoryHeaders && (
                                        <div 
                                            className={`flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-gray-50/80 transition-colors ${catInfo.color} sticky top-0 z-10 border-b border-gray-100`}
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
                                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                                    selectedInCat > 0 
                                                        ? 'bg-adhoc-violet/10 text-adhoc-violet' 
                                                        : 'bg-white/80 text-gray-500'
                                                }`}>
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
                                                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                                                    allSelected 
                                                        ? 'bg-adhoc-violet text-white hover:bg-adhoc-violet/90'
                                                        : someSelected
                                                            ? 'bg-adhoc-violet/10 text-adhoc-violet hover:bg-adhoc-violet/20'
                                                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                                }`}
                                            >
                                                {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
                                            </button>
                                        </div>
                                    )}
                                    
                                    {/* Documents in category */}
                                    {(isExpanded || !showCategoryHeaders) && (
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
                                                        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-all border-l-3 ${
                                                            isSelected ? 'border-l-adhoc-violet bg-adhoc-lavender/5' : 'border-l-transparent'
                                                        }`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                                            isSelected 
                                                                ? 'bg-adhoc-violet border-adhoc-violet scale-110' 
                                                                : 'border-gray-300 hover:border-adhoc-violet/50'
                                                        }`}>
                                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                                        </div>
                                                        <FileText className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? 'text-adhoc-violet' : 'text-gray-400'}`} />
                                                        <span className={`text-sm truncate transition-colors ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
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
                        {nonEmptyCategories.length === 0 && (
                            <div className="p-10 text-center">
                                <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                <p className="text-sm text-gray-500">
                                    {documents.length === 0 
                                        ? 'No hay documentos cargados en el sistema'
                                        : 'No se encontraron documentos que coincidan con la búsqueda'}
                                </p>
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* Footer stats */}
            <div className="flex items-center justify-between text-sm text-gray-500 px-1 pt-1">
                <span className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    {totalDocs} documento{totalDocs !== 1 ? 's' : ''} disponible{totalDocs !== 1 ? 's' : ''}
                </span>
                <span className="font-medium text-adhoc-violet">{selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}</span>
            </div>
        </div>
    )
}
