/**
 * Test Conversation with Real Skills
 *
 * Simulates a multi-turn conversation using real Odoo skills.
 */

import 'dotenv-flow/config'
import { createOdooClient } from '@/lib/skills/odoo/_client'
import type { OdooCredentials } from '@/lib/skills/types'

// Import skills
import { getSalesTotal } from '@/lib/skills/odoo/get-sales-total'
import { getSalesByCustomer } from '@/lib/skills/odoo/get-sales-by-customer'
import { getTopProducts } from '@/lib/skills/odoo/get-top-products'
import { getProductStock } from '@/lib/skills/odoo/get-product-stock'

const credentials: OdooCredentials = {
  url: 'https://trainp-cedent-26-01-1.adhoc.ar',
  db: 'odoo',
  username: 'fdelpazo',
  apiKey: 'REDACTED_API_KEY',
}

const context = {
  userId: 'test-user',
  tenantId: 'test-tenant',
  credentials: { odoo: credentials },
  locale: 'es-AR' as const,
}

async function testConversation() {
  console.log('\n🎭 Simulating Multi-Turn Conversation\n')
  console.log('='.repeat(80))

  // Turn 1: Sales total
  console.log('\n👤 User: ¿Cuánto vendimos en diciembre 2025?')
  console.log('🤖 Tuqui: Déjame consultar los datos...\n')

  try {
    const result1 = await getSalesTotal.execute(
      {
        period: { start: '2025-12-01', end: '2025-12-31' },
        state: 'confirmed',
      },
      context
    )

    if (result1.success) {
      const total = result1.data.total
      const count = result1.data.count
      console.log(`✅ Skill: get_sales_total`)
      console.log(`   Total: $${Math.round(total).toLocaleString('es-AR')}`)
      console.log(`   Órdenes: ${count}`)
      console.log(`\n🤖 Tuqui: "En diciembre 2025 vendimos $${Math.round(total).toLocaleString('es-AR')} en ${count} órdenes confirmadas."`)
    } else {
      console.log(`❌ Error: ${result1.error.message}`)
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`)
  }

  console.log('\n' + '-'.repeat(80))

  // Turn 2: Top customers
  console.log('\n👤 User: ¿Quiénes fueron los mejores clientes?')
  console.log('🤖 Tuqui: Voy a buscar los clientes con más ventas...\n')

  try {
    const result2 = await getSalesByCustomer.execute(
      {
        period: { start: '2025-12-01', end: '2025-12-31' },
        limit: 5,
        state: 'confirmed',
      },
      context
    )

    if (result2.success) {
      console.log(`✅ Skill: get_sales_by_customer`)
      console.log(`   Top 3 clientes:`)
      result2.data.customers.slice(0, 3).forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.customerName}: $${Math.round(c.totalAmount).toLocaleString('es-AR')}`)
      })

      const top3 = result2.data.customers.slice(0, 3)
      console.log(`\n🤖 Tuqui: "Los mejores clientes fueron:`)
      top3.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.customerName} con $${Math.round(c.totalAmount).toLocaleString('es-AR')}`)
      })
      console.log(`"`)
    } else {
      console.log(`❌ Error: ${result2.error.message}`)
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`)
  }

  console.log('\n' + '-'.repeat(80))

  // Turn 3: Top products
  console.log('\n👤 User: ¿Qué productos fueron los más vendidos?')
  console.log('🤖 Tuqui: Consultando los productos top...\n')

  try {
    const result3 = await getTopProducts.execute(
      {
        period: { start: '2025-12-01', end: '2025-12-31' },
        limit: 5,
        orderBy: 'revenue',
      },
      context
    )

    if (result3.success) {
      console.log(`✅ Skill: get_top_products`)
      console.log(`   Top 3 productos:`)
      result3.data.products.slice(0, 3).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.productName}: $${Math.round(p.totalRevenue).toLocaleString('es-AR')} (${p.quantitySold} unidades)`)
      })

      const top3 = result3.data.products.slice(0, 3)
      console.log(`\n🤖 Tuqui: "Los productos más vendidos fueron:`)
      top3.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.productName}: $${Math.round(p.totalRevenue).toLocaleString('es-AR')}`)
      })
      console.log(`"`)
    } else {
      console.log(`❌ Error: ${result3.error.message}`)
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n✅ Conversation test completed!\n')
}

testConversation().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
