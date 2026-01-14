/**
 * Debug: Verificar interpretación de fechas en Tuqui
 * 
 * Este test llama a Tuqui con diferentes formas de expresar fechas
 * y verifica qué interpreta.
 */

import { describe, test, beforeAll } from 'vitest'
import { getOdooClient } from '@/lib/tools/odoo/client'

const CEDENT = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'
const TUQUI_API_URL = 'https://tuqui-agents-alpha.vercel.app/api/internal/chat-test'
const INTERNAL_TEST_KEY = process.env.INTERNAL_TEST_KEY || 'test-key-change-in-prod'

const fmt = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

let odoo: any

async function askTuqui(question: string): Promise<any> {
    const response = await fetch(TUQUI_API_URL, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-internal-key': INTERNAL_TEST_KEY
        },
        body: JSON.stringify({
            tenantId: CEDENT,
            messages: [{ role: 'user', content: question }],
            sessionId: `debug-${Date.now()}`
        })
    })
    return response.json()
}

describe('Debug Interpretación de Fechas', () => {
    beforeAll(async () => {
        odoo = await getOdooClient(CEDENT)
        console.log('✅ Conectado a Odoo')
        console.log('📅 Fecha del sistema:', new Date().toISOString())
    })

    test('Referencia: Total compras REAL con fechas explícitas', async () => {
        // Jul 2025 a Ene 2026
        const result = await odoo.readGroup(
            'purchase.report',
            [
                ['date_order', '>=', '2025-07-01'],
                ['date_order', '<=', '2026-01-14'],
                ['state', 'in', ['purchase', 'done']]
            ],
            ['price_total:sum'],
            [],
            { limit: 1 }
        )
        
        const total = result[0]?.price_total || 0
        console.log('\n=== REFERENCIA ODOO DIRECTA ===')
        console.log(`Período: 2025-07-01 a 2026-01-14`)
        console.log(`Estado: [purchase, done]`)
        console.log(`Total: ${fmt(total)}`)
        console.log('(Este es el valor que Tuqui debería dar)')
    })

    test('Pregunta: "cuánto compramos desde julio del año pasado"', async () => {
        console.log('\n=== TUQUI: desde julio del año pasado ===')
        const result = await askTuqui('cuánto compramos desde julio del año pasado')
        console.log('Respuesta:', result.response?.substring(0, 500))
        console.log('\nMetrics:', {
            latencyMs: result.latencyMs,
            hasNumericData: result.quality?.hasNumericData,
            toolsUsed: result.toolsUsed
        })
    }, 60000)

    test('Pregunta: "cuánto compramos desde julio 2025 hasta hoy"', async () => {
        console.log('\n=== TUQUI: desde julio 2025 hasta hoy ===')
        const result = await askTuqui('cuánto compramos desde julio 2025 hasta hoy')
        console.log('Respuesta:', result.response?.substring(0, 500))
    }, 60000)

    test('Pregunta: "total de compras del 1 de julio 2025 al 14 de enero 2026"', async () => {
        console.log('\n=== TUQUI: con fechas explícitas ===')
        const result = await askTuqui('total de compras del 1 de julio 2025 al 14 de enero 2026')
        console.log('Respuesta:', result.response?.substring(0, 500))
    }, 60000)

    test('Pregunta: "ventas de enero 2026"', async () => {
        // Referencia
        const ref = await odoo.readGroup(
            'sale.report',
            [
                ['date', '>=', '2026-01-01'],
                ['date', '<=', '2026-01-14'],
                ['state', 'in', ['sale', 'done']]
            ],
            ['price_total:sum'],
            [],
            { limit: 1 }
        )
        console.log('\n=== Referencia Odoo: Ventas Enero 2026 ===')
        console.log(`Total real: ${fmt(ref[0]?.price_total || 0)}`)
        
        console.log('\n=== TUQUI: ventas de enero 2026 ===')
        const result = await askTuqui('ventas de enero 2026')
        console.log('Respuesta:', result.response?.substring(0, 500))
    }, 60000)

    test('Pregunta: "compras de enero 2026"', async () => {
        // Referencia
        const ref = await odoo.readGroup(
            'purchase.report',
            [
                ['date_order', '>=', '2026-01-01'],
                ['date_order', '<=', '2026-01-14'],
                ['state', 'in', ['purchase', 'done']]
            ],
            ['price_total:sum'],
            [],
            { limit: 1 }
        )
        console.log('\n=== Referencia Odoo: Compras Enero 2026 ===')
        console.log(`Total real: ${fmt(ref[0]?.price_total || 0)}`)
        
        console.log('\n=== TUQUI: compras de enero 2026 ===')
        const result = await askTuqui('compras de enero 2026')
        console.log('Respuesta:', result.response?.substring(0, 500))
    }, 60000)
})
