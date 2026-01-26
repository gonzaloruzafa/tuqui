/**
 * Test Error Messages
 *
 * Demonstrates improved error handling with various failure scenarios.
 */

import 'dotenv-flow/config'
import { createOdooClient } from '@/lib/skills/odoo/_client'
import type { OdooCredentials } from '@/lib/skills/types'

async function testScenario(name: string, credentials: OdooCredentials) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🧪 TEST: ${name}`)
  console.log('='.repeat(80))

  try {
    const odooClient = createOdooClient(credentials)
    const health = await odooClient.healthCheck()

    if (!health.ok) {
      console.log('\n' + health.message)
    } else {
      console.log('\n✅ Connection successful!')
    }
  } catch (error: any) {
    console.log('\n' + error.message)
  }

  console.log('\n' + '='.repeat(80))
}

async function runTests() {
  console.log('\n🎯 Testing Improved Error Messages\n')

  // Test 1: Wrong URL
  await testScenario('Wrong URL', {
    url: 'https://wrong-url-that-does-not-exist.com',
    db: 'odoo',
    username: 'admin',
    apiKey: 'wrong-key',
  })

  await new Promise(resolve => setTimeout(resolve, 1000))

  // Test 2: Wrong API Key
  await testScenario('Wrong API Key', {
    url: 'https://trainp-cedent-26-01-1.adhoc.ar',
    db: 'odoo',
    username: 'fdelpazo',
    apiKey: 'wrong-api-key-12345',
  })

  await new Promise(resolve => setTimeout(resolve, 1000))

  // Test 3: Wrong Database
  await testScenario('Wrong Database Name', {
    url: 'https://trainp-cedent-26-01-1.adhoc.ar',
    db: 'wrong-database-name',
    username: 'fdelpazo',
    apiKey: 'REDACTED_API_KEY',
  })

  await new Promise(resolve => setTimeout(resolve, 1000))

  // Test 4: Wrong Username
  await testScenario('Wrong Username', {
    url: 'https://trainp-cedent-26-01-1.adhoc.ar',
    db: 'odoo',
    username: 'wrong-user',
    apiKey: 'REDACTED_API_KEY',
  })

  console.log('\n✅ Error message tests completed!\n')
}

runTests().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
