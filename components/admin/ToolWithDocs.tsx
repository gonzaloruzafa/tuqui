'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/Switch'
import { DocumentSelector } from '@/components/ui/DocumentSelector'
import { ChevronDown, ChevronRight, Database } from 'lucide-react'

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
    selectedDocIds: Set<string> | string[]
    isReadOnly?: boolean
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

    if (isReadOnly) {
        // Read-only mode for base agents
        return (
            <div className={`p-4 rounded-2xl border transition-all duration-300 ${isEnabled ? 'bg-adhoc-lavender/10 border-adhoc-lavender/30' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${isEnabled ? 'bg-adhoc-violet' : 'bg-gray-300'}`} />
                    <span className="text-sm font-medium text-gray-700">{tool.label}</span>
                    {isEnabled && <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-auto">Activa</span>}
                </div>
                <p className="text-[10px] text-gray-400 mt-2 pl-7 leading-tight">{tool.description}</p>
                
                {/* Show linked docs count for knowledge_base */}
                {tool.hasDocSelector && isEnabled && (
                    <div className="mt-3 pl-7 flex items-center gap-2 text-[10px] text-adhoc-violet">
                        <Database className="w-3 h-3" />
                        <span>{Array.from(selectedDocIds).length} documentos vinculados</span>
                    </div>
                )}
            </div>
        )
    }

    // Editable mode for custom agents
    return (
        <div className={`rounded-2xl border transition-all duration-300 ${isEnabled ? 'bg-adhoc-lavender/5 border-adhoc-lavender/30' : 'bg-gray-50 border-gray-100'}`}>
            <div className="p-4">
                <div className="flex items-center gap-2">
                    <Switch
                        name="tools"
                        value={tool.slug}
                        defaultChecked={initialEnabled}
                        label={tool.label}
                        onChange={(checked) => setIsEnabled(checked)}
                    />
                    
                    {/* Expand/collapse button for doc selector */}
                    {tool.hasDocSelector && isEnabled && (
                        <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="ml-auto p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                        </button>
                    )}
                </div>
                <p className="text-[10px] text-gray-400 mt-2 pl-12 leading-tight">{tool.description}</p>
            </div>

            {/* Document Selector (expanded) */}
            {tool.hasDocSelector && isEnabled && isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 mt-2 pt-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Database className="w-3 h-3" />
                        Documentos Disponibles
                    </h4>
                    <div className="bg-white rounded-xl border border-gray-100 p-3">
                        <DocumentSelector
                            documents={documents}
                            selectedIds={selectedDocIds}
                            name="doc_ids"
                        />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 italic">
                        El agente solo podrá buscar en los documentos seleccionados.
                    </p>
                </div>
            )}
        </div>
    )
}
