/**
 * Test: Verificar período exacto 1-7 diciembre 2025
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getOdooClient } from '../lib/tools/odoo/client'

const TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

async function main() {
    const odoo = await getOdooClient(TENANT_ID)
    
    // Período exacto: 1-7 diciembre 2025, solo confirmadas
    const domain = [
        ['date_order', '>=', '2025-12-01'],
        ['date_order', '<', '2025-12-08'],
        ['state', 'in', ['sale', 'done']]
    ]
    
    console.log('=== Período: 1-7 diciembre 2025 (state = sale/done) ===\n')
    
    // Total general
    const allOrders = await odoo.searchRead('sale.order', domain, ['amount_total', 'partner_id', 'name'], 1000)
    const grandTotal = allOrders.reduce((sum, o) => sum + (o.amount_total || 0), 0)
    
    console.log(`Total órdenes: ${allOrders.length}`)
    console.log(`Total monto: $${Math.round(grandTotal).toLocaleString('es-AR')}\n`)
    
    // Agrupar por partner manualmente
    const byPartner: Record<string, number> = {}
    for (const o of allOrders) {
        const partner = Array.isArray(o.partner_id) ? o.partner_id[1] : String(o.partner_id)
        byPartner[partner] = (byPartner[partner] || 0) + o.amount_total
    }
    
    const sorted = Object.entries(byPartner)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
    
    console.log('Top 15 clientes:')
    for (const [name, total] of sorted) {
        console.log(`  ${name}: $${Math.round(total).toLocaleString('es-AR')}`)
    }
}

main().catch(console.error)
