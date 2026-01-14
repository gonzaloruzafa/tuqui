/**
 * Test: Simular exactamente lo que hace streamChatWithOdoo
 */

import { describe, test, beforeAll, expect } from 'vitest'
import { getOdooClient } from '@/lib/tools/odoo/client'
import { executeQueries, OdooSubQuery } from '@/lib/tools/odoo/query-builder'

const CEDENT = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

let odoo: any

describe('Simular Tuqui Query', () => {
    beforeAll(async () => {
        odoo = await getOdooClient(CEDENT)
        console.log('✅ Conectado a Odoo')
    })

    test('Simular query que LLM genera para "cuánto compramos en enero"', async () => {
        // Esta es la query que el LLM probablemente genera
        // cuando el usuario dice "cuánto compramos en enero"
        const query: OdooSubQuery = {
            id: 'purchases_january',
            model: 'purchase.report',
            operation: 'search',  // LLM a veces usa search en vez de aggregate
            filters: 'enero',  // Esto es lo que el LLM probablemente pasa
            // No pasa dateRange explícito
            limit: 50
        }
        
        console.log('\n=== Query enviada ===')
        console.log(JSON.stringify(query, null, 2))
        
        const [result] = await executeQueries(odoo, CEDENT, [query])
        
        console.log('\n=== Resultado ===')
        console.log(`success: ${result.success}`)
        console.log(`data.length: ${result.data?.length}`)
        console.log(`count: ${result.count}`)
        console.log(`total: ${result.total}`)
        
        // El count debería ser el real (76), no solo 50
        console.log(`\n¿Count es el real? count=${result.count}, esperado=76`)
        
        // El total debería ser el real (~31M)
        console.log(`¿Total es el real? total=${result.total?.toLocaleString()}, esperado=31,188,148`)
    })

    test('Simular query con dateRange explícito', async () => {
        const query: OdooSubQuery = {
            id: 'purchases_january_explicit',
            model: 'purchase.report',
            operation: 'search',
            dateRange: { start: '2026-01-01', end: '2026-01-31' },
            limit: 50
        }
        
        console.log('\n=== Query con dateRange explícito ===')
        
        const [result] = await executeQueries(odoo, CEDENT, [query])
        
        console.log(`data.length: ${result.data?.length}`)
        console.log(`count: ${result.count}`)
        console.log(`total: ${result.total?.toLocaleString()}`)
    })
})
