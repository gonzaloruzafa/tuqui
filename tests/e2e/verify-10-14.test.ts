/**
 * Test: Verificar registros del 10-14 enero
 */

import { describe, test, beforeAll } from 'vitest'
import { getOdooClient } from '@/lib/tools/odoo/client'

const CEDENT = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

let odoo: any

describe('Verificar rango 10-14 enero', () => {
    beforeAll(async () => {
        odoo = await getOdooClient(CEDENT)
    })

    test('Cuántos registros hay del 10-14 enero', async () => {
        const count = await odoo.searchCount('purchase.report', [
            ['date_order', '>=', '2026-01-10'],
            ['date_order', '<=', '2026-01-14'],
            ['state', 'in', ['purchase', 'done']]
        ])
        console.log('Registros 10-14 enero:', count)
        
        const total = await odoo.readGroup('purchase.report', [
            ['date_order', '>=', '2026-01-10'],
            ['date_order', '<=', '2026-01-14'],
            ['state', 'in', ['purchase', 'done']]
        ], ['price_total'], [], { limit: 1 })
        console.log('Total $:', total[0]?.price_total?.toLocaleString())
    })
})
