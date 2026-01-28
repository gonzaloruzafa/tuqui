#!/usr/bin/env npx tsx
/**
 * Verify MercadoLibre prices and links
 * 
 * Este script ejecuta búsquedas de MeLi y muestra los links/precios
 * para verificación manual
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { searchMeliWithSerper } from '../lib/skills/web-search/mercadolibre/search'

const QUERIES = [
  'PS5 consola nuevo',
  'iPhone 15 Pro Max 256GB',
  'termo Stanley 1 litro',
  'turbina LED dental',
  'notebook Lenovo ThinkPad',
]

async function verifyPrices() {
  console.log('🔍 Verificando precios y links de MercadoLibre...\n')
  
  for (const query of QUERIES) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`📦 Query: ${query}`)
    console.log('═'.repeat(60))
    
    try {
      const result = await searchMeliWithSerper(query, 3)
      const products = result.products
      
      if (products.length === 0) {
        console.log('   ⚠️ Sin resultados')
        continue
      }
      
      for (const product of products) {
        console.log(`\n   📌 ${product.title}`)
        console.log(`      💰 Precio: ${product.price ? `$${product.price.toLocaleString('es-AR')}` : 'N/A'}`)
        console.log(`      🔗 Link: ${product.url}`)
        console.log(`      📋 Snippet: ${product.snippet?.slice(0, 100) || 'N/A'}...`)
      }
      
      // Pausa entre requests para no saturar
      await new Promise(r => setTimeout(r, 1000))
      
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`)
    }
  }
  
  console.log('\n\n✅ Verificación completa')
  console.log('📋 Por favor, verificá manualmente abriendo los links en el navegador')
}

verifyPrices().catch(console.error)
