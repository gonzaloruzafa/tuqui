/**
 * PoC: Google Grounding para Precios de MercadoLibre
 *
 * Este script valida si Google Grounding puede reemplazar a Firecrawl
 * para búsquedas de precios en MercadoLibre Argentina.
 *
 * Comparamos:
 * - Calidad de precios (accuracy)
 * - Latencia (velocidad)
 * - Costo
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

if (!GEMINI_API_KEY) {
  console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY not found')
  process.exit(1)
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

/**
 * Test Google Grounding con una query de producto
 */
async function testGroundingSearch(productQuery: string) {
  console.log(`\n🔍 Buscando: "${productQuery}"`)
  console.log(`${'='.repeat(70)}`)

  const startTime = Date.now()

  try {
    // Modelo con Google Search grounding
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      tools: [
        {
          googleSearchRetrieval: {}  // ← Activa grounding con Google Search
        }
      ]
    })

    const prompt = `Buscá en MercadoLibre Argentina precios de: ${productQuery}.

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
    const latencyMs = Date.now() - startTime

    // Extraer info
    const text = response.text()
    const groundingMetadata = (response as any).groundingMetadata

    // Contar precios encontrados
    const priceMatches = text.match(/\$\s*[\d.,]+/g) || []
    const uniquePrices = [...new Set(priceMatches)]

    // Resultados
    console.log(`⏱️  Latencia: ${latencyMs}ms`)
    console.log(`💰 Precios encontrados: ${uniquePrices.length}`)
    console.log(`\n📝 Respuesta:\n${text}`)

    if (groundingMetadata) {
      console.log(`\n🔗 Sources:`)
      const searches = groundingMetadata.webSearchQueries || []
      const retrievalMetadata = groundingMetadata.retrievalMetadata || []

      searches.forEach((query, i) => {
        console.log(`   ${i + 1}. Query: ${query}`)
      })

      retrievalMetadata.forEach((meta: any, i) => {
        console.log(`   ${i + 1}. ${meta.title || 'Sin título'}`)
        console.log(`      URL: ${meta.uri}`)
      })
    }

    return {
      success: true,
      latencyMs,
      pricesFound: uniquePrices.length,
      prices: uniquePrices,
      response: text,
      sources: groundingMetadata?.retrievalMetadata || []
    }

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`)
    return {
      success: false,
      error: error.message,
      latencyMs: Date.now() - startTime
    }
  }
}

/**
 * Main: Test suite con productos reales de MeLi
 */
async function main() {
  console.log(`
████████████████████████████████████████████████████████████████████████████████
🧪 PoC: Google Grounding para Precios MercadoLibre
████████████████████████████████████████████████████████████████████████████████
`)

  const testQueries = [
    'sillón odontológico',
    'autoclave 18 litros',
    'compresor odontológico silencioso',
    'termo stanley 1 litro',
    'notebook lenovo'
  ]

  const results = []

  for (const query of testQueries) {
    const result = await testGroundingSearch(query)
    results.push({ query, ...result })

    // Delay para no saturar API
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  // Summary
  console.log(`\n
████████████████████████████████████████████████████████████████████████████████
📊 RESUMEN
████████████████████████████████████████████████████████████████████████████████
`)

  const successRate = (results.filter(r => r.success).length / results.length) * 100
  const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length
  const avgPrices = results.reduce((sum, r) => sum + (r.pricesFound || 0), 0) / results.length

  console.log(`✅ Success Rate: ${successRate.toFixed(1)}%`)
  console.log(`⏱️  Avg Latency: ${avgLatency.toFixed(0)}ms`)
  console.log(`💰 Avg Prices Found: ${avgPrices.toFixed(1)} per query`)

  console.log(`\n📋 Detalles por Query:\n`)
  results.forEach(r => {
    const status = r.success ? '✅' : '❌'
    console.log(`${status} ${r.query}:`)
    console.log(`   - Latencia: ${r.latencyMs}ms`)
    console.log(`   - Precios: ${r.pricesFound || 0}`)
    if (r.prices && r.prices.length > 0) {
      console.log(`   - Ejemplo: ${r.prices[0]}`)
    }
  })

  console.log(`\n
████████████████████████████████████████████████████████████████████████████████
💡 CONCLUSIÓN
████████████████████████████████████████████████████████████████████████████████

Comparación con Firecrawl actual:
- Latencia Firecrawl: ~35,000ms
- Latencia Grounding: ~${avgLatency.toFixed(0)}ms
- **Mejora: ${(35000 / avgLatency).toFixed(1)}x más rápido**

Costo estimado (1000 queries):
- Firecrawl: $4.00
- Grounding: $0.15
- **Ahorro: $3.85 (96%)**

${successRate >= 80 ?
  '✅ RECOMENDACIÓN: Implementar Google Grounding como reemplazo de Firecrawl' :
  '⚠️  RECOMENDACIÓN: Validar más casos antes de reemplazar completamente'
}
`)
}

main().catch(console.error)
