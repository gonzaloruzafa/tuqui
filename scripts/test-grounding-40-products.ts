/**
 * Test: Google Grounding con 40 Productos MercadoLibre
 *
 * Valida que Google Grounding funciona bien para búsquedas de precios
 * en MercadoLibre con un dataset diverso de productos.
 *
 * Métricas clave:
 * - Success rate (% de queries que devuelven precios)
 * - Latencia promedio
 * - Número de precios por query
 * - Calidad de las respuestas
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from 'dotenv'
import { resolve } from 'path'
import * as fs from 'fs'

config({ path: resolve(__dirname, '../.env.local') })

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

if (!GEMINI_API_KEY) {
  console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY not found')
  process.exit(1)
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

// 40 productos diversos de diferentes categorías
const TEST_PRODUCTS = [
  // Odontología (10)
  'sillón odontológico',
  'autoclave 18 litros',
  'compresor odontológico silencioso',
  'lámpara led odontológica',
  'micromotor odontológico',
  'ultrasonido dental',
  'amalgamador odontológico',
  'fotopolimerizadora led',
  'aspiradora odontológica',
  'rayos x dental portátil',

  // Electrónica (10)
  'notebook lenovo ideapad',
  'monitor lg 27 pulgadas',
  'teclado mecánico rgb',
  'mouse logitech mx master',
  'auriculares sony wh-1000xm5',
  'webcam logitech c920',
  'disco ssd 1tb samsung',
  'memoria ram 16gb ddr4',
  'impresora hp laserjet',
  'router wifi 6 tp-link',

  // Hogar (10)
  'termo stanley 1 litro',
  'aire acondicionado split 3500 frigorías',
  'heladera no frost 450 litros',
  'lavarropas automático 8kg',
  'microondas 30 litros',
  'aspiradora robot roomba',
  'licuadora philips 1000w',
  'freidora de aire 5 litros',
  'plancha de vapor rowenta',
  'ventilador de pie turbo',

  // Deportes (10)
  'bicicleta rodado 29',
  'cinta de correr eléctrica',
  'mancuernas 20kg par',
  'pelota de fútbol adidas',
  'zapatillas running nike',
  'bolso deportivo adidas',
  'colchoneta yoga 6mm',
  'barra dominadas pared',
  'remo máquina fitness',
  'elíptica magnética'
]

interface TestResult {
  product: string
  success: boolean
  latencyMs: number
  pricesFound: number
  prices: string[]
  answer: string
  error?: string
}

/**
 * Test Google Grounding con un producto
 */
async function testProduct(product: string): Promise<TestResult> {
  const startTime = Date.now()

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      tools: [
        {
          googleSearch: {}
        } as any
      ]
    })

    const prompt = `Buscá en MercadoLibre Argentina precios de: ${product}.

Dame los 5 productos más relevantes con:
1. Nombre del producto
2. Precio en pesos argentinos (formato: $ X.XXX.XXX)
3. Vendedor (si está disponible)

IMPORTANTE:
- SOLO precios de MercadoLibre Argentina
- Precios COMPLETOS (no cuotas)
- Formato de respuesta limpio y estructurado`

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    })

    const response = result.response
    const text = response.text()
    const latencyMs = Date.now() - startTime

    // Contar precios encontrados
    const priceMatches = text.match(/\$\s*[\d.,]+/g) || []
    const uniquePrices = [...new Set(priceMatches)]

    return {
      product,
      success: uniquePrices.length > 0,
      latencyMs,
      pricesFound: uniquePrices.length,
      prices: uniquePrices.slice(0, 5),
      answer: text.slice(0, 500)
    }

  } catch (error: any) {
    return {
      product,
      success: false,
      latencyMs: Date.now() - startTime,
      pricesFound: 0,
      prices: [],
      answer: '',
      error: error.message
    }
  }
}

/**
 * Main: Ejecutar tests en batch con delay
 */
async function main() {
  console.log(`
████████████████████████████████████████████████████████████████████████████████
🧪 Test: Google Grounding con 40 Productos MercadoLibre
████████████████████████████████████████████████████████████████████████████████
`)

  console.log(`📦 Total productos a testear: ${TEST_PRODUCTS.length}`)
  console.log(`⏱️  Tiempo estimado: ~${(TEST_PRODUCTS.length * 7 / 60).toFixed(1)} minutos\n`)

  const results: TestResult[] = []
  let completed = 0

  for (const product of TEST_PRODUCTS) {
    completed++
    console.log(`\n[${completed}/${TEST_PRODUCTS.length}] 🔍 Testeando: "${product}"`)

    const result = await testProduct(product)

    if (result.success) {
      console.log(`  ✅ Success | ${result.latencyMs}ms | ${result.pricesFound} precios | Ejemplo: ${result.prices[0]}`)
    } else {
      console.log(`  ❌ Failed | ${result.latencyMs}ms | ${result.error || 'No prices found'}`)
    }

    results.push(result)

    // Delay entre requests para no saturar API (2 segundos)
    if (completed < TEST_PRODUCTS.length) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  // Calcular métricas
  const successCount = results.filter(r => r.success).length
  const successRate = (successCount / results.length) * 100
  const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length
  const avgPrices = results.reduce((sum, r) => sum + r.pricesFound, 0) / results.length

  // Resultados por categoría
  const categories = {
    'Odontología': results.slice(0, 10),
    'Electrónica': results.slice(10, 20),
    'Hogar': results.slice(20, 30),
    'Deportes': results.slice(30, 40)
  }

  console.log(`\n
████████████████████████████████████████████████████████████████████████████████
📊 RESULTADOS FINALES
████████████████████████████████████████████████████████████████████████████████
`)

  console.log(`\n📈 MÉTRICAS GLOBALES:`)
  console.log(`  ✅ Success Rate: ${successRate.toFixed(1)}% (${successCount}/${results.length})`)
  console.log(`  ⏱️  Latencia Promedio: ${avgLatency.toFixed(0)}ms`)
  console.log(`  💰 Precios Promedio: ${avgPrices.toFixed(1)} por query`)

  console.log(`\n📊 RESULTADOS POR CATEGORÍA:\n`)
  Object.entries(categories).forEach(([category, catResults]) => {
    const catSuccess = catResults.filter(r => r.success).length
    const catSuccessRate = (catSuccess / catResults.length) * 100
    const catAvgLatency = catResults.reduce((sum, r) => sum + r.latencyMs, 0) / catResults.length
    const catAvgPrices = catResults.reduce((sum, r) => sum + r.pricesFound, 0) / catResults.length

    console.log(`${category}:`)
    console.log(`  Success: ${catSuccessRate.toFixed(0)}% (${catSuccess}/10)`)
    console.log(`  Latencia: ${catAvgLatency.toFixed(0)}ms`)
    console.log(`  Precios: ${catAvgPrices.toFixed(1)}/query\n`)
  })

  // Detectar failures
  const failures = results.filter(r => !r.success)
  if (failures.length > 0) {
    console.log(`\n❌ FAILURES (${failures.length}):\n`)
    failures.forEach(f => {
      console.log(`  - ${f.product}: ${f.error || 'No prices found'}`)
    })
  }

  // Comparación con Firecrawl baseline
  console.log(`\n
████████████████████████████████████████████████████████████████████████████████
💡 COMPARACIÓN CON FIRECRAWL
████████████████████████████████████████████████████████████████████████████████

Baseline Firecrawl (medido en PoC previo):
  - Latencia: ~35,000ms (35 segundos)
  - Costo: $4.00 / 1000 queries
  - Login walls: Frecuentes

Google Grounding (este test):
  - Latencia: ~${avgLatency.toFixed(0)}ms (${(avgLatency / 1000).toFixed(1)} segundos)
  - Costo: ~$0.15 / 1000 queries
  - Login walls: No aplica

MEJORAS:
  - **Velocidad: ${(35000 / avgLatency).toFixed(1)}x más rápido**
  - **Costo: ${((4.00 - 0.15) / 4.00 * 100).toFixed(0)}% más barato**
  - **Confiabilidad: ${successRate >= 90 ? 'Excelente' : successRate >= 80 ? 'Buena' : 'Necesita mejoras'}**
`)

  // Guardar resultados
  const outputPath = resolve(__dirname, `./e2e-tests/results/grounding-40-products-${new Date().toISOString().split('T')[0]}.json`)
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalProducts: results.length,
    successRate,
    avgLatency,
    avgPrices,
    categories,
    results
  }, null, 2))

  console.log(`\n💾 Resultados guardados en: ${outputPath}`)

  // Conclusión
  if (successRate >= 90) {
    console.log(`\n✅ CONCLUSIÓN: Google Grounding está LISTO para producción`)
    console.log(`   - Success rate excelente (${successRate.toFixed(1)}%)`)
    console.log(`   - Latencia aceptable (${avgLatency.toFixed(0)}ms)`)
    console.log(`   - Recomendación: ELIMINAR Firecrawl y ecommerce_search`)
  } else if (successRate >= 80) {
    console.log(`\n⚠️  CONCLUSIÓN: Google Grounding necesita validación adicional`)
    console.log(`   - Success rate buena pero no excelente (${successRate.toFixed(1)}%)`)
    console.log(`   - Revisar failures antes de eliminar Firecrawl`)
  } else {
    console.log(`\n❌ CONCLUSIÓN: Google Grounding NO está listo`)
    console.log(`   - Success rate insuficiente (${successRate.toFixed(1)}%)`)
    console.log(`   - NO eliminar Firecrawl todavía`)
  }

  console.log(`\n████████████████████████████████████████████████████████████████████████████████\n`)
}

main().catch(console.error)
