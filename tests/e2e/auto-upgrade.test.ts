/**
 * Test: Verificar auto-upgrade de search a aggregate
 */

import { describe, test, beforeAll, expect } from 'vitest'
import { getOdooClient } from '@/lib/tools/odoo/client'
import { executeQueries, OdooSubQuery } from '@/lib/tools/odoo/query-builder'

const CEDENT = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

let odoo: any

describe('Auto-upgrade Search Test', () => {
    beforeAll(async () => {
        odoo = await getOdooClient(CEDENT)
        console.log('✅ Conectado a Odoo')
    })

    test('operation: search DEBE devolver total real aunque limite a 50 registros', async () => {
        const query: OdooSubQuery = {
            id: 'test-search',
            model: 'purchase.report',
            operation: 'search',
            dateRange: { start: '2026-01-01', end: '2026-01-14' },
            limit: 50
        }
        
        const [result] = await executeQueries(odoo, CEDENT, [query])
        
        console.log('\n=== RESULTADO search con auto-upgrade ===')
        console.log(`Data length: ${result.data?.length}`)
        console.log(`Count: ${result.count}`)
        console.log(`Total: ${result.total}`)
        
        // El count debería ser el real (76), no solo 50
        expect(result.count).toBeGreaterThan(50)
        
        // El total debería ser ~31M, no la suma de solo 50 registros
        expect(result.total).toBeGreaterThan(30_000_000)
        
        console.log(`\n✅ Auto-upgrade funcionando: count=${result.count}, total=$${result.total?.toLocaleString()}`)
    })

    test('operation: aggregate SIN groupBy debería funcionar igual', async () => {
        const query: OdooSubQuery = {
            id: 'test-aggregate',
            model: 'purchase.report',
            operation: 'aggregate',
            dateRange: { start: '2026-01-01', end: '2026-01-14' },
            limit: 50
        }
        
        const [result] = await executeQueries(odoo, CEDENT, [query])
        
        console.log('\n=== RESULTADO aggregate sin groupBy ===')
        console.log(`Count: ${result.count}`)
        console.log(`Total: ${result.total}`)
        
        // Debería tener los mismos valores
        expect(result.count).toBe(76)  // Número de registros
        expect(result.total).toBeGreaterThan(30_000_000)
    })
})
