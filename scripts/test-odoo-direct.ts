/**
 * Test directo a Odoo sin LLM - ver qué devuelve la query
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getOdooClient } from '../lib/tools/odoo/client'

const TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

async function main() {
    const odoo = await getOdooClient(TENANT_ID)
    
    // Query directa: sale.order primera semana diciembre 2025
    // 1-7 diciembre 2025
    const domain = [
        ['date_order', '>=', '2025-12-01'],
        ['date_order', '<', '2025-12-08']
    ]
    
    console.log('=== Query 1: Lista de ordenes (top 20 por monto) ===')
    const orders = await odoo.searchRead('sale.order', domain, ['name', 'partner_id', 'amount_total', 'state', 'date_order'], 20, 0, 'amount_total desc')
    
    console.log(`Found ${orders.length} orders:\n`)
    for (const o of orders) {
        const partner = Array.isArray(o.partner_id) ? o.partner_id[1] : o.partner_id
        console.log(`${o.name} | ${partner} | $${Math.round(o.amount_total).toLocaleString('es-AR')} | ${o.state} | ${o.date_order}`)
    }
    
    console.log('\n=== Query 2: Agrupado por cliente (read_group) ===')
    const grouped = await odoo.readGroup('sale.order', domain, ['partner_id'], ['partner_id'], 'amount_total desc', 10)
    
    console.log(`\nTop 10 por cliente:`)
    for (const g of grouped) {
        const partner = Array.isArray(g.partner_id) ? g.partner_id[1] : g.partner_id
        console.log(`${partner}: count=${g.partner_id_count}`)
    }
}

main().catch(console.error)
