/**
 * Test: Verificar diciembre 2025
 */

import { describe, test, beforeAll } from 'vitest'
import { getOdooClient } from '@/lib/tools/odoo/client'

const CEDENT = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

let odoo: any

describe('Diciembre 2025', () => {
    beforeAll(async () => {
        odoo = await getOdooClient(CEDENT)
    })

    test('Registros y total de diciembre 2025', async () => {
        const count = await odoo.searchCount('purchase.report', [
            ['date_order', '>=', '2025-12-01'],
            ['date_order', '<=', '2025-12-31'],
            ['state', 'in', ['purchase', 'done']]
        ])
        console.log('Registros diciembre 2025:', count)
        
        const total = await odoo.readGroup('purchase.report', [
            ['date_order', '>=', '2025-12-01'],
            ['date_order', '<=', '2025-12-31'],
            ['state', 'in', ['purchase', 'done']]
        ], ['price_total'], [], { limit: 1 })
        console.log('Total $:', total[0]?.price_total?.toLocaleString())
    })
})
