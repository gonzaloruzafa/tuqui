import { describe, test, beforeAll } from 'vitest'
import { getOdooClient } from '@/lib/tools/odoo/client'

const CEDENT = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'
let odoo: any

describe('Enero 2026', () => {
    beforeAll(async () => {
        odoo = await getOdooClient(CEDENT)
    })

    test('Total compras enero 2026 con filtro state', async () => {
        const count = await odoo.searchCount('purchase.report', [
            ['date_order', '>=', '2026-01-01'],
            ['date_order', '<=', '2026-01-31'],
            ['state', 'in', ['purchase', 'done']]
        ])
        
        const total = await odoo.readGroup('purchase.report', [
            ['date_order', '>=', '2026-01-01'],
            ['date_order', '<=', '2026-01-31'],
            ['state', 'in', ['purchase', 'done']]
        ], ['price_total:sum'], [], { limit: 1 })
        
        console.log('\n=== ENERO 2026 (con filtro state) ===')
        console.log('Registros:', count)
        console.log('Total: $' + (total[0]?.price_total || 0).toLocaleString('es-AR'))
    })
})

    test('Simular lo que hace Tuqui (executeQueries con operation:search)', async () => {
        const { executeQueries } = await import('@/lib/tools/odoo/query-builder')
        
        const result = await executeQueries(odoo, CEDENT, [{
            id: 'test',
            model: 'purchase.report',
            operation: 'search',
            filters: 'enero 2026',
            limit: 50
        }])
        
        console.log('\n=== executeQueries (operation: search) ===')
        console.log('data.length:', result[0]?.data?.length)
        console.log('count:', result[0]?.count)
        console.log('total:', result[0]?.total)
    })
