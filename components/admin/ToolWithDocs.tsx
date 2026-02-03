'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/Switch'
import { DocumentSelector } from '@/components/ui/DocumentSelector'
import { ChevronDown, ChevronRight, Database, Globe, LayoutDashboard, BookOpen } from 'lucide-react'

interface Document {
    id: string
    title?: string
    metadata: { filename?: string; category?: string } | null
}

interface ToolConfig {
    slug: string
    label: string
    description: string
    hasDocSelector?: boolean
}

interface ToolWithDocsProps {
    tool: ToolConfig
    isEnabled: boolean
    documents: Document[]
    selectedDocIds: string[]  // Must be Array (Sets don't serialize in RSC)
    isReadOnly?: boolean
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
    web_search: <Globe className="w-5 h-5" />,
    odoo_intelligent_query: <LayoutDashboard className="w-5 h-5" />,
    knowledge_base: <BookOpen className="w-5 h-5" />,
}

export function ToolWithDocs({ 
    tool, 
    isEnabled: initialEnabled, 
    documents, 
    selectedDocIds,
    isReadOnly = false
}: ToolWithDocsProps) {
    const [isEnabled, setIsEnabled] = useState(initialEnabled)
    const [isExpanded, setIsExpanded] = useState(initialEnabled && tool.hasDocSelector)

    useEffect(() => {
        if (tool.hasDocSelector && isEnabled) {
            setIsExpanded(true)
        }
    }, [isEnabled, tool.hasDocSelector])

    const selectedCount = selectedDocIds?.length || 0
    const icon = TOOL_ICONS[tool.slug] || <Database className="w-5 h-5" />

    if (isReadOnly) {
        // Read-only mode for base agents
        return (
            <div className={`rounded-2xl border transition-all duration-300 ${isEnabled ? 'bg-white border-adhoc-lavender/40 shadow-sm' : 'bg-gray-50/50 border-gray-100 opacity-60'}`}>
                <div className="p-5 flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isEnabled ? 'bg-adhoc-violet/10 text-adhoc-violet' : 'bg-gray-100 text-gray-400'}`}>
                        {icon}
                    </div>
                    <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{tool.label}</span>
                            {isEnabled && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Activa</span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed">{tool.description}</p>
                        
                        {/* Show linked docs count for knowledge_base */}
                        {tool.hasDocSelector && isEnabled && selectedCount > 0 && (
                            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-adhoc-lavender/10 rounded-lg">
                                <Database className="w-3.5 h-3.5 text-adhoc-violet" />
                                <span className="text-sm font-medium text-adhoc-violet">{selectedCount} documento{selectedCount !== 1 ? 's' : ''} vinculado{selectedCount !== 1 ? 's' : ''}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // Editable mode for custom agents
    return (
        <div className={`rounded-2xl border transition-all duration-300 ${isEnabled ? 'bg-white border-adhoc-lavender/40 shadow-sm' : 'bg-gray-50/50 border-gray-100'}`}>
            <div className="p-5 flex items-start gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isEnabled ? 'bg-adhoc-violet/10 text-adhoc-violet' : 'bg-gray-100 text-gray-400'}`}>
                    {icon}
                </div>
                <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                        <span className={`font-semibold transition-colors ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>{tool.label}</span>
                        <Switch
                            name="tools"
                            value={tool.slug}
                            defaultChecked={initialEnabled}
                            onChange={(checked) => setIsEnabled(checked)}
                        />
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">{tool.description}</p>
                    
                    {/* Document selector toggle for knowledge_base */}
                    {tool.hasDocSelector && isEnabled && (
                        <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                                selectedCount > 0 
                                    ? 'bg-adhoc-lavender/10 hover:bg-adhoc-lavender/20' 
                                    : 'bg-amber-50 hover:bg-amber-100 border border-amber-200'
                            }`}
                        >
                            {isExpanded ? (
                                <ChevronDown className={`w-4 h-4 ${selectedCount > 0 ? 'text-adhoc-violet' : 'text-amber-600'}`} />
                            ) : (
                                <ChevronRight className={`w-4 h-4 ${selectedCount > 0 ? 'text-adhoc-violet' : 'text-amber-600'}`} />
                            )}
                            <Database className={`w-3.5 h-3.5 ${selectedCount > 0 ? 'text-adhoc-violet' : 'text-amber-600'}`} />
                            <span className={`text-sm font-medium ${selectedCount > 0 ? 'text-adhoc-violet' : 'text-amber-700'}`}>
                                {selectedCount > 0 
                                    ? `${selectedCount} documento${selectedCount !== 1 ? 's' : ''} seleccionado${selectedCount !== 1 ? 's' : ''}`
                                    : '⚠️ Sin documentos — seleccionar'}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Document Selector (expanded) */}
            {tool.hasDocSelector && isEnabled && isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-100 mt-2 pt-5">
                    <DocumentSelector
                        documents={documents}
                        selectedIds={selectedDocIds}
                        name="doc_ids"
                    />
                    <p className="text-xs text-gray-400 mt-3 italic">
                        El agente solo podrá buscar en los documentos seleccionados.
                    </p>
                </div>
            )}
        </div>
    )
}
