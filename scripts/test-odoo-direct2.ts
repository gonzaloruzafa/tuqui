/**
 * Test directo: read_group con amount_total
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getOdooClient } from '../lib/tools/odoo/client'

const TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

async function main() {
    const odoo = await getOdooClient(TENANT_ID)
    
    // Primera semana diciembre 2025, SOLO confirmadas
    const domain = [
        ['date_order', '>=', '2025-12-01'],
        ['date_order', '<', '2025-12-08'],
        ['state', '=', 'sale']  // Solo confirmadas
    ]
    
    console.log('=== read_group con amount_total (solo state=sale) ===')
    
    // read_group con amount_total como campo a sumar
    const grouped = await odoo.readGroup(
        'sale.order', 
        domain, 
        ['partner_id', 'amount_total:sum'],  // Sumar amount_total
        ['partner_id'],  // Agrupar por partner
        'amount_total desc',  // Ordenar por monto
        10  // Top 10
    )
    
    console.log(`\nTop 10 clientes (state=sale):`)
    for (const g of grouped) {
        const partner = Array.isArray(g.partner_id) ? g.partner_id[1] : g.partner_id
        const total = g.amount_total || g['amount_total:sum'] || 0
        console.log(`${partner}: $${Math.round(total).toLocaleString('es-AR')} (${g.partner_id_count} ordenes)`)
    }
    
    // Total general
    const allOrders = await odoo.searchRead('sale.order', domain, ['amount_total'], 1000)
    const grandTotal = allOrders.reduce((sum, o) => sum + (o.amount_total || 0), 0)
    console.log(`\nTotal general (state=sale): $${Math.round(grandTotal).toLocaleString('es-AR')}`)
    console.log(`Cantidad de ordenes: ${allOrders.length}`)
}

main().catch(console.error)
