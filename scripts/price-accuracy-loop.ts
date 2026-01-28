#!/usr/bin/env npx tsx
/**
 * Price Accuracy Verification Loop
 * 
 * Este script verifica la precisión de precios de MercadoLibre:
 * 1. Obtiene productos de Serper (URLs reales)
 * 2. Scrapea precios reales con Puppeteer
 * 3. Compara con los precios del Grounding/agente
 * 4. Reporta discrepancias
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const BASE_URL = process.env.EVAL_BASE_URL || 'http://localhost:3000'
const INTERNAL_KEY = process.env.INTERNAL_TEST_KEY || 'test-key-change-in-prod'
const TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

interface ScrapedProduct {
  url: string
  title: string | null
  realPrice: number | null
  error?: string
}

interface PriceComparison {
  query: string
  agentMentionedPrices: number[]
  scrapedProducts: ScrapedProduct[]
  priceAccuracy: {
    withinRange: boolean
    minMentioned: number | null
    maxMentioned: number | null
    minActual: number | null
    maxActual: number | null
    avgDifferencePercent: number | null
  }
}

const TEST_QUERIES = [
  'termo Stanley 1 litro',
  'PS5 consola',
  'iPhone 15 Pro Max 256GB',
  'turbina LED dental',
  'notebook Lenovo ThinkPad',
]

/**
 * Call agent API
 */
async function callAgent(question: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/internal/chat-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': INTERNAL_KEY,
    },
    body: JSON.stringify({
      tenantId: TENANT_ID,
      agentSlug: 'tuqui',
      messages: [{ role: 'user', content: `¿Cuánto cuesta un ${question} en MercadoLibre?` }],
    }),
  })

  if (!response.ok) {
    throw new Error(`API error ${response.status}`)
  }

  const data = await response.json()
  return data.response || ''
}

/**
 * Extract prices from agent response
 */
function extractPricesFromResponse(response: string): number[] {
  const prices: number[] = []
  
  // Match various price formats:
  // **$69.999** or $69.999 or 💰 **$69.999** or *$49.500*
  const patterns = [
    /\*?\*?\$\s*([\d.]+(?:,\d+)?)\*?\*?/g,
    /💰[^$]*\$\s*([\d.]+(?:,\d+)?)/g,
  ]
  
  for (const pattern of patterns) {
    const matches = response.matchAll(pattern)
    for (const match of matches) {
      // Parse Argentine price format: $65.999 means 65999
      const priceStr = match[1].replace(/\./g, '').replace(',', '.')
      const price = parseFloat(priceStr)
      if (!isNaN(price) && price > 1000 && !prices.includes(price)) {
        prices.push(price)
      }
    }
  }
  
  return prices.sort((a, b) => a - b)
}

/**
 * Extract MeLi URLs from agent response
 */
function extractMeliUrls(response: string): string[] {
  const urlPattern = /https?:\/\/articulo\.mercadolibre\.com\.ar\/MLA-\d+[^\s\)\]"<>]*/gi
  const matches = response.match(urlPattern) || []
  return [...new Set(matches.map(u => u.replace(/[,\.\)\]]+$/, '')))]
}

/**
 * Scrape real price from MercadoLibre page
 */
async function scrapeRealPrice(page: Page, url: string): Promise<ScrapedProduct> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await new Promise(r => setTimeout(r, 2000))
    
    // Price selectors
    const priceSelectors = [
      '.andes-money-amount__fraction',
      'meta[itemprop="price"]',
    ]
    
    let price: number | null = null
    for (const selector of priceSelectors) {
      try {
        if (selector.startsWith('meta')) {
          const metaPrice = await page.$eval(selector, el => el.getAttribute('content'))
          if (metaPrice) {
            price = parseFloat(metaPrice)
            break
          }
        } else {
          const priceText = await page.$eval(selector, el => el.textContent)
          if (priceText) {
            const cleanPrice = priceText.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
            price = parseFloat(cleanPrice)
            if (!isNaN(price)) break
          }
        }
      } catch {
        continue
      }
    }
    
    // Title
    let title: string | null = null
    try {
      title = await page.$eval('h1.ui-pdp-title', el => el.textContent?.trim() || null)
    } catch {
      try {
        title = await page.$eval('meta[property="og:title"]', el => el.getAttribute('content'))
      } catch {}
    }
    
    return { url, title, realPrice: price }
  } catch (error) {
    return { 
      url, 
      title: null, 
      realPrice: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Run single query verification
 */
async function verifyQuery(browser: Browser, query: string): Promise<PriceComparison> {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`🔍 Query: "${query}"`)
  console.log('─'.repeat(60))
  
  // Get agent response
  console.log('   📤 Calling agent...')
  const response = await callAgent(query)
  
  // Extract what agent says
  const mentionedPrices = extractPricesFromResponse(response)
  const urls = extractMeliUrls(response)
  
  console.log(`   💰 Agent mentioned ${mentionedPrices.length} prices: ${mentionedPrices.map(p => `$${p.toLocaleString()}`).join(', ') || 'none'}`)
  console.log(`   🔗 Found ${urls.length} valid MeLi URLs`)
  
  // Scrape real prices
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')
  
  const scrapedProducts: ScrapedProduct[] = []
  
  for (const url of urls.slice(0, 3)) { // Limit to 3 to avoid rate limiting
    console.log(`   🌐 Scraping: ${url.substring(0, 55)}...`)
    const product = await scrapeRealPrice(page, url)
    scrapedProducts.push(product)
    
    if (product.realPrice) {
      console.log(`      ✓ ${product.title?.substring(0, 40)}... → $${product.realPrice.toLocaleString()}`)
    } else {
      console.log(`      ⚠️ No price found${product.error ? `: ${product.error}` : ''}`)
    }
    
    await new Promise(r => setTimeout(r, 1000)) // Rate limit
  }
  
  await page.close()
  
  // Calculate accuracy
  const realPrices = scrapedProducts.map(p => p.realPrice).filter((p): p is number => p !== null)
  
  const minMentioned = mentionedPrices.length > 0 ? Math.min(...mentionedPrices) : null
  const maxMentioned = mentionedPrices.length > 0 ? Math.max(...mentionedPrices) : null
  const minActual = realPrices.length > 0 ? Math.min(...realPrices) : null
  const maxActual = realPrices.length > 0 ? Math.max(...realPrices) : null
  
  let avgDifferencePercent: number | null = null
  let withinRange = false
  
  if (minMentioned && maxMentioned && minActual && maxActual) {
    // Check if real prices fall within mentioned range (with 20% tolerance)
    const tolerance = 0.20
    const mentionedMin = minMentioned * (1 - tolerance)
    const mentionedMax = maxMentioned * (1 + tolerance)
    
    withinRange = realPrices.some(p => p >= mentionedMin && p <= mentionedMax)
    
    // Calculate average difference
    const avgMentioned = (minMentioned + maxMentioned) / 2
    const avgActual = (minActual + maxActual) / 2
    avgDifferencePercent = ((avgActual - avgMentioned) / avgMentioned) * 100
  }
  
  // Report
  console.log('\n   📊 Comparison:')
  console.log(`      Agent said: $${minMentioned?.toLocaleString() || 'N/A'} - $${maxMentioned?.toLocaleString() || 'N/A'}`)
  console.log(`      Real prices: $${minActual?.toLocaleString() || 'N/A'} - $${maxActual?.toLocaleString() || 'N/A'}`)
  
  if (avgDifferencePercent !== null) {
    const diffSymbol = avgDifferencePercent > 0 ? '📈' : '📉'
    console.log(`      ${diffSymbol} Difference: ${avgDifferencePercent > 0 ? '+' : ''}${avgDifferencePercent.toFixed(1)}%`)
    console.log(`      ${withinRange ? '✅' : '❌'} Within range: ${withinRange ? 'YES' : 'NO'}`)
  } else {
    console.log(`      ⚠️ Cannot compare (missing data)`)
  }
  
  return {
    query,
    agentMentionedPrices: mentionedPrices,
    scrapedProducts,
    priceAccuracy: {
      withinRange,
      minMentioned,
      maxMentioned,
      minActual,
      maxActual,
      avgDifferencePercent,
    },
  }
}

/**
 * Main verification loop
 */
async function main() {
  const iterations = parseInt(process.argv[2] || '1', 10)
  
  console.log('═'.repeat(60))
  console.log('💰 PRICE ACCURACY VERIFICATION LOOP')
  console.log('═'.repeat(60))
  console.log(`Running ${iterations} iteration(s) with ${TEST_QUERIES.length} queries each\n`)
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  
  const allResults: PriceComparison[] = []
  
  for (let iter = 1; iter <= iterations; iter++) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`📍 ITERATION ${iter}/${iterations}`)
    console.log('═'.repeat(60))
    
    for (const query of TEST_QUERIES) {
      try {
        const result = await verifyQuery(browser, query)
        allResults.push(result)
      } catch (error) {
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`)
      }
    }
  }
  
  await browser.close()
  
  // Final summary
  console.log(`\n${'═'.repeat(60)}`)
  console.log('📊 FINAL SUMMARY')
  console.log('═'.repeat(60))
  
  const withComparison = allResults.filter(r => r.priceAccuracy.avgDifferencePercent !== null)
  const withinRange = allResults.filter(r => r.priceAccuracy.withinRange)
  
  console.log(`\nTotal queries: ${allResults.length}`)
  console.log(`Comparable results: ${withComparison.length}`)
  console.log(`Within range (±20%): ${withinRange.length} (${((withinRange.length / Math.max(withComparison.length, 1)) * 100).toFixed(1)}%)`)
  
  if (withComparison.length > 0) {
    const avgDiff = withComparison.reduce((sum, r) => sum + (r.priceAccuracy.avgDifferencePercent || 0), 0) / withComparison.length
    console.log(`Average price difference: ${avgDiff > 0 ? '+' : ''}${avgDiff.toFixed(1)}%`)
  }
  
  // Individual results
  console.log('\n📝 Per-query results:')
  for (const r of allResults) {
    const status = r.priceAccuracy.withinRange ? '✅' : (r.priceAccuracy.avgDifferencePercent !== null ? '❌' : '⚠️')
    const diff = r.priceAccuracy.avgDifferencePercent
    console.log(`   ${status} ${r.query}: ${diff !== null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : 'N/A'}`)
  }
  
  console.log('\n' + '═'.repeat(60))
}

main().catch(console.error)
