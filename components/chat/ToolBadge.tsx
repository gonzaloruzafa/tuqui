/**
 * ToolBadge Component
 * 
 * Badge compacto que muestra las fuentes usadas debajo del mensaje completado.
 * Simple, sin expand/collapse, sin thinking text.
 */

'use client'

import { ThinkingSource, SOURCE_NAMES } from '@/lib/thinking/types'

interface ToolBadgeProps {
    sources: ThinkingSource[]
    agentName?: string
}

const LOGOS: Record<ThinkingSource, React.ReactNode> = {
    odoo: <img src="/logo-odoo.png" alt="Odoo" className="w-3.5 h-3.5 rounded-sm" />,
    meli: <img src="/logo-meli.png" alt="MercadoLibre" className="w-3.5 h-3.5 rounded-sm" />,
    web: (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" className="text-blue-500" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" className="text-blue-500" />
        </svg>
    ),
    rag: (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2" fill="#10B981" />
            <path d="M8 8h8M8 12h8M8 16h4" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    general: (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
            <circle cx="12" cy="12" r="10" fill="#8B5CF6" />
            <path d="M12 8v4l3 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
}

export function ToolBadge({ sources, agentName }: ToolBadgeProps) {
    if (!sources || sources.length === 0) return null
    
    // Filter out 'general' source when agent name is shown (redundant)
    const uniqueSources = [...new Set(sources)].filter(s => !(agentName && s === 'general'))
    
    // Nothing to show if only general sources and agent name covers it
    if (!agentName && uniqueSources.length === 0) return null
    
    return (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
            <span className="text-green-500">✓</span>
            <span>vía</span>
            {agentName && (
                <span className="font-medium text-adhoc-violet">{agentName}</span>
            )}
            {agentName && uniqueSources.length > 0 && <span className="mx-0.5">·</span>}
            {uniqueSources.map((source, idx) => (
                <span key={source} className="flex items-center gap-1 opacity-80">
                    {LOGOS[source]}
                    <span className="text-gray-500">{SOURCE_NAMES[source]}</span>
                    {idx < uniqueSources.length - 1 && <span className="mx-0.5">•</span>}
                </span>
            ))}
        </div>
    )
}
