/**
 * Quick test: Validar routing fixes para CASH-01, OPS-01, CEO-03
 */

import { routeMessage } from '../lib/agents/router'

const TEST_QUERIES = [
  {
    id: 'CASH-01',
    message: '¿Cuánta plata tenemos disponible hoy en caja?',
    expectedAgent: 'odoo'
  },
  {
    id: 'OPS-01',
    message: '¿Qué productos están por quedarse sin stock?',
    expectedAgent: 'odoo'
  },
  {
    id: 'CEO-03',
    message: 'Dame los 3 números más importantes que debo saber hoy',
    expectedAgent: 'odoo'
  }
]

const SUB_AGENTS = [
  { slug: 'tuqui', name: 'Tuqui', specialty: 'general', keywords: [] },
  { slug: 'odoo', name: 'Odoo', specialty: 'erp', keywords: [] },
  { slug: 'meli', name: 'MeLi', specialty: 'mercado', keywords: [] }
]

async function main() {
  console.log('🧪 Testing Routing Fixes\n')

  let passed = 0
  let failed = 0

  for (const test of TEST_QUERIES) {
    const result = await routeMessage(test.message, SUB_AGENTS as any, [])

    const success = result.selectedAgent.slug === test.expectedAgent
    const icon = success ? '✅' : '❌'

    console.log(`${icon} ${test.id}: ${test.message.substring(0, 50)}...`)
    console.log(`   Expected: ${test.expectedAgent} | Got: ${result.selectedAgent.slug}`)
    console.log(`   Reason: ${result.reason}`)
    console.log(`   Scores:`, result.scores)
    console.log('')

    if (success) passed++
    else failed++
  }

  console.log(`\n📊 Results: ${passed}/${TEST_QUERIES.length} passed`)

  if (passed === TEST_QUERIES.length) {
    console.log('✅ All routing tests passed!')
    process.exit(0)
  } else {
    console.log(`❌ ${failed} routing tests failed`)
    process.exit(1)
  }
}

main().catch(console.error)
