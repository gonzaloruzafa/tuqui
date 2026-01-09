/**
 * Direct Router Test - Sin necesidad de API corriendo
 *
 * Testea el router directamente para validar las mejoras de keywords
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local
config({ path: resolve(__dirname, '../../.env.local') })

import { routeMessage } from '@/lib/agents/router'

// ============================================
// TEST CASES
// ============================================

interface TestCase {
  id: string
  category: string
  message: string
  expectedAgent: 'odoo' | 'meli' | 'tuqui'
  priority: 'critical' | 'high' | 'medium'
  description?: string
}

const TEST_CASES: TestCase[] = [
  // CASH FLOW - CRÍTICO
  {
    id: 'CASH-01',
    category: 'Cash Flow',
    message: '¿Cuánta plata tenemos disponible hoy en caja?',
    expectedAgent: 'odoo',
    priority: 'critical',
    description: 'Antes fallaba: ruteaba a tuqui base'
  },
  {
    id: 'CASH-02',
    category: 'Cash Flow',
    message: '¿Cuánto nos deben los clientes?',
    expectedAgent: 'odoo',
    priority: 'critical'
  },
  {
    id: 'CASH-03',
    category: 'Cash Flow',
    message: 'Dame el total de cuentas por cobrar',
    expectedAgent: 'odoo',
    priority: 'high'
  },

  // STOCK - CRÍTICO
  {
    id: 'STOCK-01',
    category: 'Stock',
    message: '¿Qué productos están por quedarse sin stock?',
    expectedAgent: 'odoo',
    priority: 'critical',
    description: 'Antes fallaba: ruteaba a tuqui base'
  },
  {
    id: 'STOCK-02',
    category: 'Stock',
    message: 'Dame el inventario valorizado total',
    expectedAgent: 'odoo',
    priority: 'critical'
  },
  {
    id: 'STOCK-03',
    category: 'Stock',
    message: '¿Cuánto stock tenemos de productos críticos?',
    expectedAgent: 'odoo',
    priority: 'high'
  },

  // DASHBOARD EJECUTIVO - CRÍTICO
  {
    id: 'EXEC-01',
    category: 'Executive',
    message: 'Dame un resumen ejecutivo del mes',
    expectedAgent: 'odoo',
    priority: 'critical'
  },
  {
    id: 'EXEC-02',
    category: 'Executive',
    message: 'Dame los 3 números más importantes que debo saber hoy',
    expectedAgent: 'odoo',
    priority: 'critical',
    description: 'Antes fallaba: ruteaba a tuqui base'
  },
  {
    id: 'EXEC-03',
    category: 'Executive',
    message: '¿Cómo estamos vs el mes pasado?',
    expectedAgent: 'odoo',
    priority: 'high'
  },

  // VENTAS - SHOULD WORK
  {
    id: 'SALES-01',
    category: 'Sales',
    message: '¿Cuánto vendimos hoy?',
    expectedAgent: 'odoo',
    priority: 'high'
  },
  {
    id: 'SALES-02',
    category: 'Sales',
    message: 'Dame el ranking de vendedores del mes',
    expectedAgent: 'odoo',
    priority: 'high'
  },

  // DRILL-DOWN - CRÍTICO PARA CONTEXTO
  {
    id: 'CONTEXT-01',
    category: 'Context',
    message: '¿Quién es nuestro mejor cliente?',
    expectedAgent: 'odoo',
    priority: 'high'
  },
  {
    id: 'CONTEXT-02',
    category: 'Context',
    message: '¿Cuánto vendió ese vendedor?',
    expectedAgent: 'odoo',
    priority: 'critical',
    description: 'Debe reconocer "ese vendedor" como referencia a contexto'
  },

  // PRICING - EXTERNOS (MELI)
  {
    id: 'PRICE-EXT-01',
    category: 'Pricing External',
    message: 'cuanto sale un autoclave 18 litros',
    expectedAgent: 'meli',
    priority: 'critical',
    description: 'Sin referencia interna → debe ir a MeLi'
  },
  {
    id: 'PRICE-EXT-02',
    category: 'Pricing External',
    message: 'buscame precios de compresor odontológico',
    expectedAgent: 'meli',
    priority: 'critical'
  },
  {
    id: 'PRICE-EXT-03',
    category: 'Pricing External',
    message: 'Ahora buscame cuánto sale en MercadoLibre',
    expectedAgent: 'meli',
    priority: 'critical',
    description: 'Override explícito de MeLi'
  },

  // PRICING - INTERNOS (ODOO)
  {
    id: 'PRICE-INT-01',
    category: 'Pricing Internal',
    message: '¿A cuánto vendemos el autoclave de 18 litros?',
    expectedAgent: 'odoo',
    priority: 'critical',
    description: 'Referencia interna → debe ir a Odoo'
  },
  {
    id: 'PRICE-INT-02',
    category: 'Pricing Internal',
    message: 'Dame nuestros precios de autoclaves',
    expectedAgent: 'odoo',
    priority: 'high'
  }
]

// ============================================
// RUNNER
// ============================================

const TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

interface TestResult {
  id: string
  category: string
  message: string
  expectedAgent: string
  actualAgent: string | null
  passed: boolean
  confidence: string
  reason: string
  scores: Record<string, number>
  description?: string
}

async function runTests() {
  console.log('\n' + '█'.repeat(80))
  console.log('🧪 Direct Router Test - Validación de Mejoras de Keywords')
  console.log('█'.repeat(80) + '\n')

  const results: TestResult[] = []
  let passed = 0
  let failed = 0

  // Group by category
  const byCategory = TEST_CASES.reduce((acc, test) => {
    if (!acc[test.category]) acc[test.category] = []
    acc[test.category].push(test)
    return acc
  }, {} as Record<string, TestCase[]>)

  for (const [category, tests] of Object.entries(byCategory)) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`📂 ${category}`)
    console.log('='.repeat(80))

    for (const test of tests) {
      const result = await routeMessage(TENANT_ID, test.message, [])

      const actualAgent = result.selectedAgent?.slug || null
      const isPassed = actualAgent === test.expectedAgent

      if (isPassed) passed++
      else failed++

      const status = isPassed ? '✅' : '❌'
      const priority = test.priority === 'critical' ? '🔴' : test.priority === 'high' ? '🟠' : '🟡'

      console.log(`\n${status} ${priority} ${test.id}`)
      console.log(`   Message: "${test.message}"`)
      console.log(`   Expected: ${test.expectedAgent} | Got: ${actualAgent || 'none'}`)
      console.log(`   Confidence: ${result.confidence} | Reason: ${result.reason}`)

      if (Object.keys(result.scores).length > 0) {
        console.log(`   Scores: ${JSON.stringify(result.scores)}`)
      }

      if (test.description) {
        console.log(`   📝 ${test.description}`)
      }

      if (!isPassed) {
        console.log(`   ⚠️  FAILED: Expected "${test.expectedAgent}" but got "${actualAgent}"`)
      }

      results.push({
        id: test.id,
        category: test.category,
        message: test.message,
        expectedAgent: test.expectedAgent,
        actualAgent,
        passed: isPassed,
        confidence: result.confidence,
        reason: result.reason,
        scores: result.scores,
        description: test.description
      })
    }
  }

  // Summary
  console.log('\n' + '█'.repeat(80))
  console.log('📊 SUMMARY')
  console.log('█'.repeat(80))

  const successRate = (passed / TEST_CASES.length * 100).toFixed(1)
  console.log(`\n✅ Passed: ${passed}/${TEST_CASES.length} (${successRate}%)`)
  console.log(`❌ Failed: ${failed}/${TEST_CASES.length}`)

  // By category
  console.log('\n📈 By Category:')
  for (const [category, tests] of Object.entries(byCategory)) {
    const categoryResults = results.filter(r => r.category === category)
    const categoryPassed = categoryResults.filter(r => r.passed).length
    const rate = (categoryPassed / tests.length * 100).toFixed(0)
    const status = categoryPassed === tests.length ? '✅' : categoryPassed > tests.length / 2 ? '⚠️' : '❌'
    console.log(`   ${status} ${category}: ${categoryPassed}/${tests.length} (${rate}%)`)
  }

  // Critical failures
  const criticalFailures = results.filter(r => !r.passed && TEST_CASES.find(t => t.id === r.id)?.priority === 'critical')
  if (criticalFailures.length > 0) {
    console.log('\n🔴 CRITICAL FAILURES:')
    criticalFailures.forEach(f => {
      console.log(`   - ${f.id}: "${f.message}" → routed to "${f.actualAgent}" instead of "${f.expectedAgent}"`)
    })
  }

  // Save results
  const fs = await import('fs')
  const path = await import('path')
  const resultsDir = path.join(__dirname, 'results')
  const timestamp = new Date().toISOString().split('T')[0]
  const outputFile = path.join(resultsDir, `router-direct-${timestamp}.json`)

  const report = {
    timestamp: new Date().toISOString(),
    successRate: parseFloat(successRate),
    passed,
    failed,
    total: TEST_CASES.length,
    results,
    summary: {
      byCategory: Object.entries(byCategory).map(([category, tests]) => {
        const categoryResults = results.filter(r => r.category === category)
        const categoryPassed = categoryResults.filter(r => r.passed).length
        return {
          category,
          passed: categoryPassed,
          total: tests.length,
          rate: categoryPassed / tests.length
        }
      })
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2))
  console.log(`\n💾 Results saved to: ${outputFile}`)

  console.log('\n' + '█'.repeat(80) + '\n')

  // Exit with error if success rate < 85%
  if (parseFloat(successRate) < 85) {
    console.log('⚠️  Success rate below 85%, exiting with error code')
    process.exit(1)
  }
}

// Run
runTests().catch(console.error)
