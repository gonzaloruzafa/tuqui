/**
 * Test Odoo Connection
 *
 * Validates that a tenant's Odoo credentials are working correctly.
 * Provides detailed error messages if connection fails.
 *
 * Usage:
 *   npx tsx scripts/test-odoo-connection.ts <tenant-id>
 *   npx tsx scripts/test-odoo-connection.ts de7ef34a-12bd-4fe9-9d02-3d876a9393c2
 */

import 'dotenv-flow/config'
import { getClient } from '@/lib/supabase/client'
import { decrypt } from '@/lib/crypto'
import { createOdooClient } from '@/lib/skills/odoo/_client'

async function testConnection(tenantId: string) {
  console.log('\n🔍 Testing Odoo Connection\n')
  console.log(`Tenant ID: ${tenantId}\n`)
  console.log('='.repeat(80))

  try {
    // 1. Load credentials from database
    console.log('\n📦 Step 1: Loading credentials from database...')

    const db = getClient()
    const { data: integration, error } = await db
      .from('integrations')
      .select('config, is_active')
      .eq('tenant_id', tenantId)
      .eq('type', 'odoo')
      .single()

    if (error || !integration) {
      console.error('❌ No Odoo integration found for this tenant')
      console.error('   Check that the tenant has an active Odoo integration configured')
      process.exit(1)
    }

    if (!integration.is_active) {
      console.error('❌ Odoo integration is disabled')
      console.error('   Enable it in the admin panel')
      process.exit(1)
    }

    console.log('✅ Integration found in database')

    // 2. Decrypt credentials
    console.log('\n🔐 Step 2: Decrypting credentials...')

    const config = integration.config
    const credentials = {
      url: config.odoo_url || config.url,
      db: config.odoo_db || config.db,
      username: config.odoo_user || config.username,
      apiKey: decrypt(config.odoo_password || config.api_key || ''),
    }

    console.log('✅ Credentials decrypted')
    console.log(`   URL: ${credentials.url}`)
    console.log(`   Database: ${credentials.db}`)
    console.log(`   Username: ${credentials.username}`)
    console.log(`   API Key: ${credentials.apiKey.substring(0, 8)}...`)

    // 3. Create Odoo client
    console.log('\n🔧 Step 3: Creating Odoo client...')

    const odooClient = createOdooClient(credentials)

    console.log('✅ Client created')

    // 4. Run health check
    console.log('\n🏥 Step 4: Running health check...')

    const health = await odooClient.healthCheck()

    if (!health.ok) {
      console.error('\n' + health.message)
      process.exit(1)
    }

    console.log('✅ ' + health.message)

    // 5. Test basic query
    console.log('\n🔍 Step 5: Testing basic query (count partners)...')

    const partnerCount = await odooClient.searchCount('res.partner', [])

    console.log(`✅ Query successful - Found ${partnerCount} partners`)

    // 6. Test aggregation
    console.log('\n📊 Step 6: Testing aggregation (top 5 customers by sales)...')

    const topCustomers = await odooClient.readGroup(
      'sale.order',
      [['state', 'in', ['sale', 'done']]],
      ['partner_id', 'amount_total:sum'],
      ['partner_id'],
      { limit: 5, orderBy: 'amount_total desc' }
    )

    console.log(`✅ Aggregation successful - Found ${topCustomers.length} customers`)

    if (topCustomers.length > 0) {
      console.log('\n   Top 3 customers:')
      topCustomers.slice(0, 3).forEach((c: any, i: number) => {
        const name = Array.isArray(c.partner_id) ? c.partner_id[1] : 'Unknown'
        const total = c.amount_total || 0
        console.log(`   ${i + 1}. ${name}: $${Math.round(total).toLocaleString('es-AR')}`)
      })
    }

    console.log('\n' + '='.repeat(80))
    console.log('\n✅ All tests passed! Odoo connection is working correctly.\n')

  } catch (error: any) {
    console.error('\n' + '='.repeat(80))
    console.error('\n❌ Connection test failed:\n')
    console.error(error.message || error)
    console.error('\n' + '='.repeat(80) + '\n')
    process.exit(1)
  }
}

// Parse command line arguments
const tenantId = process.argv[2]

if (!tenantId) {
  console.error('Usage: npx tsx scripts/test-odoo-connection.ts <tenant-id>')
  console.error('\nExample:')
  console.error('  npx tsx scripts/test-odoo-connection.ts de7ef34a-12bd-4fe9-9d02-3d876a9393c2')
  process.exit(1)
}

// Run test
testConnection(tenantId).catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
