/**
 * Test directo de la tool web_search para ver qué devuelve
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { MeliSkills } from '../lib/skills/web-search/mercadolibre'

async function main() {
  console.log('Testing MeliSkills.hybrid directly...\n')
  
  const query = 'turbina led dental'
  
  const result = await MeliSkills.hybrid(query, {
    maxResults: 3,
    useCache: false,
  })
  
  console.log('\n═══════════════════════════════════════')
  console.log('PRODUCTOS (de Serper):')
  console.log('═══════════════════════════════════════')
  result.products.forEach((p, i) => {
    console.log(`\n${i + 1}. ${p.title}`)
    console.log(`   URL: ${p.url}`)
    console.log(`   Precio: ${p.priceFormatted || 'N/A'}`)
  })
  
  console.log('\n═══════════════════════════════════════')
  console.log('ANÁLISIS (de Grounding):')
  console.log('═══════════════════════════════════════')
  console.log(result.analysis.substring(0, 500) + '...')
  
  // Check if analysis contains URLs
  const urlsInAnalysis = result.analysis.match(/https?:\/\/[^\s\)\]"<>]+/gi) || []
  console.log(`\n⚠️ URLs encontradas en el análisis: ${urlsInAnalysis.length}`)
  urlsInAnalysis.forEach((url, i) => console.log(`   ${i + 1}. ${url}`))
}

main().catch(console.error)
