/**
 * Extended Thinking Types
 * 
 * Tipos para el sistema de "thinking" que muestra al usuario
 * qué está haciendo el modelo mientras ejecuta tools.
 */

/**
 * Source/Agent que está ejecutando el tool
 */
export type ThinkingSource = 'odoo' | 'meli' | 'web' | 'rag' | 'general'

/**
 * Estado del step de thinking
 */
export type ThinkingStatus = 'running' | 'done' | 'error'

/**
 * Un step de thinking individual
 */
export interface ThinkingStep {
    /** Nombre del tool siendo ejecutado */
    tool: string
    /** Source/agente que lo ejecuta */
    source: ThinkingSource
    /** Estado actual */
    status: ThinkingStatus
    /** Duración en ms (solo cuando status=done) */
    duration?: number
    /** Mensaje de error (solo cuando status=error) */
    error?: string
    /** Timestamp de inicio */
    startedAt: number
}

/**
 * Evento de thinking para streaming
 */
export interface ThinkingEvent {
    type: 'thinking'
    step: ThinkingStep
}

/**
 * Callback para emitir eventos de thinking durante tool execution
 */
export type OnThinkingStep = (step: ThinkingStep) => void

/**
 * Mapping de tool name a source
 */
export function getToolSource(toolName: string): ThinkingSource {
    // Odoo skills
    const odooTools = [
        'get_sales', 'get_invoices', 'get_debt', 'get_overdue',
        'get_product', 'get_stock', 'get_customer', 'get_payments',
        'get_purchase', 'get_vendor', 'get_cash', 'get_accounts',
        'search_customers', 'search_products', 'get_top', 'compare_sales',
        'get_pending', 'get_low_stock', 'get_ar_aging', 'get_new_customers'
    ]
    
    if (odooTools.some(prefix => toolName.startsWith(prefix))) {
        return 'odoo'
    }
    
    // RAG / Knowledge Base (check before web to avoid false positives)
    if (toolName.includes('rag') || toolName.includes('document') || toolName.includes('knowledge')) {
        return 'rag'
    }
    
    // MercadoLibre (explicit meli tools only)
    if (toolName.includes('mercadolibre') || toolName.includes('meli')) {
        return 'meli'
    }
    
    // Web search genérico
    if (toolName.includes('web') || toolName === 'web_search') {
        return 'web'
    }
    
    return 'general'
}

/**
 * Logos para cada source (URLs hardcodeadas)
 */
export const SOURCE_LOGOS: Record<ThinkingSource, string> = {
    odoo: '/logos/odoo.svg',
    meli: '/logos/meli.svg',
    web: '/logos/web.svg',
    rag: '/logos/rag.svg',
    general: '/logos/tuqui.svg'
}

/**
 * Nombres amigables para cada source
 */
export const SOURCE_NAMES: Record<ThinkingSource, string> = {
    odoo: 'Odoo ERP',
    meli: 'MercadoLibre',
    web: 'Búsqueda Web',
    rag: 'Base de Conocimiento',
    general: 'Tuqui'
}
