/**
 * ExecutionProgress Component
 * 
 * Línea única tipo ChatGPT mostrando el estado actual de ejecución.
 * Transiciones suaves con fade in/out entre estados.
 */

'use client'

import { useState, useEffect } from 'react'
import { ThinkingStep, SOURCE_NAMES } from '@/lib/thinking/types'

interface ExecutionProgressProps {
    step: ThinkingStep | null
}

const TOOL_NAMES: Record<string, string> = {
    'get_sales_total': 'Consultando ventas totales',
    'get_sales_by_customer': 'Consultando ventas por cliente',
    'get_sales_by_product': 'Consultando ventas por producto',
    'get_invoices_by_customer': 'Consultando facturas',
    'get_debt_by_customer': 'Consultando deudas',
    'get_overdue_invoices': 'Buscando facturas vencidas',
    'get_accounts_receivable': 'Consultando cuentas por cobrar',
    'get_product_stock': 'Verificando stock',
    'get_low_stock_products': 'Buscando productos con bajo stock',
    'search_customers': 'Buscando clientes',
    'search_products': 'Buscando productos',
    'get_customer_balance': 'Consultando saldo',
    'get_payments_received': 'Consultando pagos recibidos',
    'get_purchase_orders': 'Buscando órdenes de compra',
    'web_search': 'Buscando en la web',
    'get_top_products': 'Analizando productos más vendidos',
    'get_top_customers': 'Analizando mejores clientes',
    'compare_sales_periods': 'Comparando períodos',
    'get_new_customers': 'Buscando nuevos clientes',
    'get_top_stock_products': 'Analizando productos en stock',
}

const LOGOS: Record<string, React.ReactNode> = {
    odoo: <img src="/logo-odoo.png" alt="Odoo" className="w-4 h-4 rounded-sm" />,
    meli: <img src="/logo-meli.png" alt="MercadoLibre" className="w-4 h-4 rounded-sm" />,
    web: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" className="text-blue-500" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" className="text-blue-500" />
        </svg>
    ),
    rag: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2" fill="#10B981" />
            <path d="M8 8h8M8 12h8M8 16h4" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    general: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <circle cx="12" cy="12" r="10" fill="#8B5CF6" />
            <path d="M12 8v4l3 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
}

export function ExecutionProgress({ step }: ExecutionProgressProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [displayStep, setDisplayStep] = useState<ThinkingStep | null>(null)
    
    useEffect(() => {
        if (step) {
            // Fade out current, then fade in new
            setIsVisible(false)
            const timer = setTimeout(() => {
                setDisplayStep(step)
                setIsVisible(true)
            }, 150) // Half of transition duration
            return () => clearTimeout(timer)
        } else {
            setIsVisible(false)
        }
    }, [step])
    
    if (!displayStep) return null
    
    const toolName = TOOL_NAMES[displayStep.tool] || displayStep.tool.replace(/_/g, ' ')
    const sourceName = SOURCE_NAMES[displayStep.source]
    const logo = LOGOS[displayStep.source]
    
    const statusEmoji = displayStep.status === 'running' ? '⚡' : 
                       displayStep.status === 'done' ? '✓' : '⚠️'
    
    return (
        <div 
            className={`flex items-center gap-2 text-sm text-gray-500 mb-3 transition-opacity duration-300 ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
        >
            <span className={displayStep.status === 'running' ? 'animate-pulse' : ''}>
                {statusEmoji}
            </span>
            <span className="flex items-center gap-1.5">
                {logo}
                <span className="text-gray-600">{toolName}</span>
            </span>
            {displayStep.status === 'done' && displayStep.duration && (
                <span className="text-xs text-gray-400">
                    ({(displayStep.duration / 1000).toFixed(1)}s)
                </span>
            )}
        </div>
    )
}
