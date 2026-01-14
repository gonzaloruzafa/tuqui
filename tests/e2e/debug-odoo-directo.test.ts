/**
 * Debug: Query directa a Odoo para verificar datos reales
 */

import { describe, test, beforeAll } from 'vitest'
import { getOdooClient } from '@/lib/tools/odoo/client'

const CEDENT = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

const fmt = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

let odoo: any

describe('Debug Odoo Directo', () => {
    beforeAll(async () => {
        odoo = await getOdooClient(CEDENT)
        console.log('✅ Conectado a Odoo')
    })

    test('Top 10 proveedores - Query directa', async () => {
        // Query directa con orderby correcto
        const result = await odoo.readGroup(
            'purchase.report',
            [
                ['date_order', '>=', '2025-07-01'],
                ['date_order', '<=', '2026-01-14'],
                ['state', 'in', ['purchase', 'done']]
            ],
            ['partner_id', 'price_total:sum'],
            ['partner_id'],
            { orderby: 'price_total desc', limit: 10 }
        )
        
        console.log('\n=== TOP 10 PROVEEDORES (Jul 2025 - Ene 2026) ===')
        console.log('=== Con filtro state IN [purchase, done] ===\n')
        
        let total = 0
        result.forEach((r: any, i: number) => {
            const name = r.partner_id?.[1] || 'Sin nombre'
            const amount = r.price_total || 0
            total += amount
            console.log(`${i + 1}. ${name}: ${fmt(amount)}`)
        })
        
        console.log(`\nTotal top 10: ${fmt(total)}`)
    })

    test('Total compras - Con y sin filtro de estado', async () => {
        // CON filtro
        const conFiltro = await odoo.readGroup(
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
        
        // SIN filtro de estado
        const sinFiltro = await odoo.readGroup(
            'purchase.report',
            [
                ['date_order', '>=', '2025-07-01'],
                ['date_order', '<=', '2026-01-14']
            ],
            ['price_total:sum'],
            [],
            { limit: 1 }
        )
        
        const totalConFiltro = conFiltro[0]?.price_total || 0
        const totalSinFiltro = sinFiltro[0]?.price_total || 0
        
        console.log('\n=== TOTAL COMPRAS (Jul 2025 - Ene 2026) ===\n')
        console.log(`CON filtro [purchase, done]: ${fmt(totalConFiltro)}`)
        console.log(`SIN filtro de estado:        ${fmt(totalSinFiltro)}`)
        console.log(`\nDiferencia: ${fmt(totalSinFiltro - totalConFiltro)} (${((totalSinFiltro - totalConFiltro) / totalSinFiltro * 100).toFixed(1)}%)`)
    })

    test('Distribución por estado', async () => {
        const result = await odoo.readGroup(
            'purchase.report',
            [
                ['date_order', '>=', '2025-07-01'],
                ['date_order', '<=', '2026-01-14']
            ],
            ['state', 'price_total:sum'],
            ['state'],
            { orderby: 'price_total desc' }
        )
        
        console.log('\n=== DISTRIBUCIÓN POR ESTADO ===\n')
        let total = 0
        result.forEach((r: any) => {
            const amount = r.price_total || 0
            total += amount
            const count = r.__count || r.state_count || '?'
            console.log(`${r.state}: ${fmt(amount)} (${count} registros)`)
        })
        console.log(`\nTOTAL: ${fmt(total)}`)
    })

    test('Ventas este mes - Enero 2026', async () => {
        const conFiltro = await odoo.readGroup(
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
        
        const sinFiltro = await odoo.readGroup(
            'sale.report',
            [
                ['date', '>=', '2026-01-01'],
                ['date', '<=', '2026-01-14']
            ],
            ['price_total:sum'],
            [],
            { limit: 1 }
        )
        
        console.log('\n=== VENTAS ENERO 2026 ===\n')
        console.log(`CON filtro [sale, done]: ${fmt(conFiltro[0]?.price_total || 0)}`)
        console.log(`SIN filtro de estado:    ${fmt(sinFiltro[0]?.price_total || 0)}`)
    })

    test('Cuentas por cobrar', async () => {
        // account.move con residual
        const result = await odoo.readGroup(
            'account.move',
            [
                ['move_type', '=', 'out_invoice'],
                ['state', '=', 'posted'],
                ['payment_state', 'in', ['not_paid', 'partial']]
            ],
            ['amount_residual:sum'],
            [],
            { limit: 1 }
        )
        
        console.log('\n=== CUENTAS POR COBRAR ===\n')
        console.log(`Facturas pendientes (posted, not_paid/partial): ${fmt(result[0]?.amount_residual || 0)}`)
    })
})
