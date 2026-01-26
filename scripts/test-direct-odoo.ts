/**
 * Test Direct Odoo Connection
 *
 * Tests Odoo connection with direct credentials (no database lookup).
 * Useful for validating credentials before saving to database.
 */

import 'dotenv-flow/config'
import { createOdooClient } from '@/lib/skills/odoo/_client'
import type { OdooCredentials } from '@/lib/skills/types'

const credentials: OdooCredentials = {
  url: 'https://trainp-cedent-26-01-1.adhoc.ar',
  db: 'odoo',
  username: 'fdelpazo',
  apiKey: 'REDACTED_API_KEY',
}

async function testDirectConnection() {
  console.log('\n🔍 Testing Direct Odoo Connection\n')
  console.log('='.repeat(80))

  console.log('\n📝 Credentials:')
  console.log(`   URL: ${credentials.url}`)
  console.log(`   Database: ${credentials.db}`)
  console.log(`   Username: ${credentials.username}`)
  console.log(`   API Key: ${credentials.apiKey.substring(0, 8)}...`)

  try {
    // 1. Create client
    console.log('\n🔧 Step 1: Creating Odoo client...')
    const odooClient = createOdooClient(credentials)
    console.log('✅ Client created')

    // 2. Run health check
    console.log('\n🏥 Step 2: Running health check...')
    const health = await odooClient.healthCheck()

    if (!health.ok) {
      console.error('\n' + health.message)
      process.exit(1)
    }

    console.log('✅ ' + health.message)

    // 3. Test basic query
    console.log('\n🔍 Step 3: Testing basic query (count partners)...')
    const partnerCount = await odooClient.searchCount('res.partner', [])
    console.log(`✅ Query successful - Found ${partnerCount} partners`)

    // 4. Test sales query (December 2025)
    console.log('\n📊 Step 4: Testing sales query (December 2025)...')
    const salesOrders = await odooClient.searchCount('sale.order', [
      ['date_order', '>=', '2025-12-01'],
      ['date_order', '<=', '2025-12-31'],
      ['state', 'in', ['sale', 'done']],
    ])
    console.log(`✅ Found ${salesOrders} sales orders in December 2025`)

    // 5. Test aggregation
    console.log('\n📈 Step 5: Testing aggregation (top 5 customers)...')
    const topCustomers = await odooClient.readGroup(
      'sale.order',
      [['state', 'in', ['sale', 'done']]],
      ['partner_id', 'amount_total:sum'],
      ['partner_id'],
      { limit: 5, orderBy: 'amount_total desc' }
    )

    console.log(`✅ Aggregation successful - Found ${topCustomers.length} customers`)

    if (topCustomers.length > 0) {
      console.log('\n   Top customers:')
      topCustomers.forEach((c: any, i: number) => {
        const name = Array.isArray(c.partner_id) ? c.partner_id[1] : 'Unknown'
        const total = c.amount_total || 0
        console.log(`   ${i + 1}. ${name}: $${Math.round(total).toLocaleString('es-AR')}`)
      })
    }

    // 6. Test December 2025 sales total
    console.log('\n💰 Step 6: Testing December 2025 sales total...')
    const decemberSales = await odooClient.readGroup(
      'sale.order',
      [
        ['date_order', '>=', '2025-12-01'],
        ['date_order', '<=', '2025-12-31'],
        ['state', 'in', ['sale', 'done']],
      ],
      ['amount_total:sum'],
      [],
      { limit: 1 }
    )

    if (decemberSales.length > 0) {
      const total = decemberSales[0].amount_total || 0
      console.log(`✅ December 2025 sales: $${Math.round(total).toLocaleString('es-AR')}`)
    } else {
      console.log('⚠️  No sales found in December 2025')
    }

    console.log('\n' + '='.repeat(80))
    console.log('\n✅ All tests passed! Connection is working correctly.\n')

  } catch (error: any) {
    console.error('\n' + '='.repeat(80))
    console.error('\n❌ Connection test failed:\n')
    console.error(error.message || error)
    console.error('\n' + '='.repeat(80) + '\n')
    process.exit(1)
  }
}

// Run test
testDirectConnection().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
