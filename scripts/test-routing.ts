/**
 * Script de pruebas para validar routing y agentes
 * Ejecuta preguntas de prueba y verifica respuestas
 */

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface TestCase {
  question: string
  expectedAgent: string // 'tuqui' | 'meli' | 'odoo'
  shouldUseTool?: string // tool name that should be called
  description: string
}

const testCases: TestCase[] = [
  // Casos MeLi
  {
    question: 'Cuanto cuesta un iPhone 15 en MercadoLibre?',
    expectedAgent: 'meli',
    shouldUseTool: 'web_search',
    description: 'Pregunta de precio debería ir a MeLi'
  },
  {
    question: 'Busca precios de notebooks Lenovo',
    expectedAgent: 'meli',
    shouldUseTool: 'web_search',
    description: 'Búsqueda de precios → MeLi'
  },
  {
    question: 'Cuanto sale una bicicleta rodado 29?',
    expectedAgent: 'meli',
    shouldUseTool: 'web_search',
    description: 'Pregunta con "cuánto sale" → MeLi'
  },
  
  // Casos Odoo
  {
    question: 'Cuanto vendimos este mes?',
    expectedAgent: 'odoo',
    shouldUseTool: 'odoo_intelligent_query',
    description: 'Pregunta de ventas → Odoo'
  },
  {
    question: 'Dame el stock de productos',
    expectedAgent: 'odoo',
    shouldUseTool: 'odoo_intelligent_query',
    description: 'Consulta de stock → Odoo'
  },
  {
    question: 'Cual es la deuda de los clientes?',
    expectedAgent: 'odoo',
    shouldUseTool: 'odoo_intelligent_query',
    description: 'Consulta de deudas → Odoo'
  },
  
  // Casos Tuqui (general)
  {
    question: 'Hola, como estas?',
    expectedAgent: 'tuqui',
    description: 'Saludo general → Tuqui'
  },
  {
    question: 'Que podes hacer?',
    expectedAgent: 'tuqui',
    description: 'Pregunta sobre capacidades → Tuqui'
  },
]

// Keywords predefinidos para matching (copiados del router)
const SPECIALTY_KEYWORDS: Record<string, string[]> = {
    'erp': [
        'venta', 'ventas', 'vendimos', 'factura', 'facturas', 'facturamos',
        'cliente', 'clientes', 'proveedor', 'proveedores', 
        'producto', 'productos', 'stock', 'inventario',
        'compra', 'compras', 'compramos', 'pedido', 'pedidos',
        'cobro', 'cobros', 'cobramos', 'pago', 'pagos', 'pagamos',
        'deuda', 'deudas', 'saldo', 'cuenta corriente',
        'vendedor', 'vendedores', 'trimestre', 'mes pasado', 'este año',
        'odoo', 'erp', 'sistema'
    ],
    'mercado': [
        'mercadolibre', 'meli', 'publicacion', 'publicaciones',
        'precio de', 'precios de', 'buscar producto', 'cuanto cuesta',
        'cuanto sale', 'comparar precio', 'marketplace', 'mercado libre'
    ],
    'legal': [
        'ley', 'leyes', 'legal', 'contrato', 'contratos',
        'demanda', 'abogado', 'juicio', 'indemnización',
        'despido', 'sociedad', 'sas', 'srl', 'sa',
        'estatuto', 'acta', 'poder', 'representación'
    ],
    'contador': [
        'iva', 'impuesto', 'impuestos', 'monotributo', 'afip',
        'ddjj', 'declaración jurada', 'ganancias', 'bienes personales',
        'contador', 'contable', 'balance', 'asiento', 'libro diario',
        'factura electrónica', 'cae', 'régimen'
    ],
}

const specialtyToSlug: Record<string, string> = {
    'erp': 'odoo',
    'mercado': 'meli',
    'legal': 'abogado',
    'contador': 'contador',
}

function analyzeMessage(message: string): Record<string, number> {
    const msgLower = message.toLowerCase()
    const scores: Record<string, number> = {}

    for (const [specialty, keywords] of Object.entries(SPECIALTY_KEYWORDS)) {
        let score = 0
        for (const keyword of keywords) {
            if (msgLower.includes(keyword)) {
                score += keyword.split(' ').length
            }
        }
        if (score > 0) {
            scores[specialty] = score
        }
    }

    return scores
}

function localRouteMessage(message: string): string {
    const scores = analyzeMessage(message)
    
    if (Object.keys(scores).length === 0) {
        return 'tuqui'
    }
    
    const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1])
    const topSpecialty = sortedScores[0][0]
    
    return specialtyToSlug[topSpecialty] || 'tuqui'
}

async function testRouting() {
  console.log('🧪 Testing Routing System\n')
  console.log('=' .repeat(60))
  
  // Get agents from DB first
  const { data: agents, error } = await db
    .from('agents')
    .select('id, slug, name, tools, system_prompt, description, rag_enabled')
    
  if (error) {
    console.error('❌ Error fetching agents:', error.message)
    return
  }
  
  console.log('📋 Agents configured:')
  for (const agent of agents || []) {
    console.log(`   - ${agent.slug}: ${agent.name} (tools: ${agent.tools?.join(', ') || 'none'})`)
  }
  console.log()
  
  // Test routing locally (simulating router logic)
  console.log('🔀 Testing message routing:\n')
  
  let passed = 0
  let failed = 0
  
  for (const test of testCases) {
    // Route the message locally
    const routedTo = localRouteMessage(test.question)
    const success = routedTo === test.expectedAgent
    
    if (success) {
      console.log(`✅ "${test.question}"`)
      console.log(`   → Routed to: ${routedTo} (expected: ${test.expectedAgent})`)
      passed++
    } else {
      console.log(`❌ "${test.question}"`)
      console.log(`   → Routed to: ${routedTo} (expected: ${test.expectedAgent})`)
      console.log(`   Description: ${test.description}`)
      failed++
    }
    console.log()
  }
  
  console.log('=' .repeat(60))
  console.log(`📊 Results: ${passed}/${testCases.length} passed, ${failed} failed`)
  
  return { passed, failed, total: testCases.length }
}

async function testAgentTools() {
  console.log('\n🔧 Testing Agent Tool Configuration\n')
  console.log('=' .repeat(60))
  
  const expectedTools: Record<string, string[]> = {
    'tuqui': ['web_search', 'web_investigator'],
    'meli': ['web_search', 'web_investigator'],
    'odoo': ['odoo_intelligent_query'],
    'contador': ['web_search'],
    'abogado': ['web_search'],
  }
  
  const { data: agents, error } = await db
    .from('agents')
    .select('slug, name, tools')
    
  if (error) {
    console.error('❌ Error:', error.message)
    return
  }
  
  let passed = 0
  let failed = 0
  
  for (const agent of agents || []) {
    const expected = expectedTools[agent.slug]
    if (!expected) continue
    
    const actual = agent.tools || []
    const hasAllTools = expected.every(t => actual.includes(t))
    const hasExtraTools = actual.some(t => !expected.includes(t))
    
    if (hasAllTools && !hasExtraTools) {
      console.log(`✅ ${agent.slug}: ${actual.join(', ')}`)
      passed++
    } else {
      console.log(`❌ ${agent.slug}:`)
      console.log(`   Has: ${actual.join(', ')}`)
      console.log(`   Expected: ${expected.join(', ')}`)
      failed++
    }
  }
  
  console.log('=' .repeat(60))
  console.log(`📊 Results: ${passed} correct, ${failed} incorrect`)
  
  return { passed, failed }
}

async function testAPIEndpoint() {
  console.log('\n🌐 Testing API Endpoint\n')
  console.log('=' .repeat(60))
  
  const testQuestions = [
    { q: 'Hola!', agent: 'tuqui' },
    { q: 'Busca precios de zapatillas Nike', agent: 'meli' },
  ]
  
  for (const { q, agent } of testQuestions) {
    console.log(`Testing: "${q}"`)
    
    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: q }],
          agentSlug: 'tuqui'
        })
      })
      
      if (response.ok) {
        console.log(`   ✅ API responded (status: ${response.status})`)
        
        // Try to read streaming response
        const text = await response.text()
        console.log(`   Response preview: ${text.substring(0, 100)}...`)
      } else {
        console.log(`   ⚠️ API returned ${response.status}`)
      }
    } catch (err: any) {
      console.log(`   ❌ Error: ${err.message}`)
      console.log(`   (Make sure server is running on ${BASE_URL})`)
    }
    console.log()
  }
}

async function main() {
  console.log('🚀 Tuqui Agents Test Suite\n')
  console.log(new Date().toLocaleString('es-AR'))
  console.log()
  
  // Test 1: Agent tools configuration
  await testAgentTools()
  
  // Test 2: Routing
  await testRouting()
  
  // Test 3: API (optional, needs server running)
  const args = process.argv.slice(2)
  if (args.includes('--api')) {
    await testAPIEndpoint()
  } else {
    console.log('\n💡 Tip: Run with --api to also test the API endpoint')
  }
  
  console.log('\n✨ Tests complete!')
}

main().catch(console.error)
