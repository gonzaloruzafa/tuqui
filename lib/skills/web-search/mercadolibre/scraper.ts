/**
 * MercadoLibre Price Scraper
 * 
 * Scrapea precios reales de las páginas de MeLi usando fetch + regex
 * Más rápido que Puppeteer para obtener datos básicos
 */

import { parsePrice } from './types'

interface ScrapedPrice {
  price: number | null
  priceFormatted: string | null
  error?: string
}

/**
 * Scrape price from a MercadoLibre product page
 * 
 * Uses fetch + regex instead of browser to be faster
 * Falls back gracefully if page is protected
 */
export async function scrapeMeliPrice(url: string): Promise<ScrapedPrice> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
      },
    })

    if (!response.ok) {
      return { price: null, priceFormatted: null, error: `HTTP ${response.status}` }
    }

    const html = await response.text()
    
    // Try multiple patterns to extract price
    
    // 1. JSON-LD structured data (most reliable)
    const jsonLdMatch = html.match(/"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/i)
    if (jsonLdMatch) {
      const price = parseFloat(jsonLdMatch[1])
      if (!isNaN(price) && price > 100) {
        return { 
          price, 
          priceFormatted: formatPriceAR(price) 
        }
      }
    }
    
    // 2. Meta tag itemprop="price"
    const metaPriceMatch = html.match(/itemprop="price"\s+content="(\d+(?:\.\d+)?)"/i)
    if (metaPriceMatch) {
      const price = parseFloat(metaPriceMatch[1])
      if (!isNaN(price) && price > 100) {
        return { 
          price, 
          priceFormatted: formatPriceAR(price) 
        }
      }
    }
    
    // 3. Price fraction in DOM (andes-money-amount__fraction)
    const fractionMatch = html.match(/andes-money-amount__fraction[^>]*>(\d{1,3}(?:\.\d{3})*)<\/span/i)
    if (fractionMatch) {
      const priceStr = fractionMatch[1].replace(/\./g, '')
      const price = parseInt(priceStr, 10)
      if (!isNaN(price) && price > 100) {
        return { 
          price, 
          priceFormatted: formatPriceAR(price) 
        }
      }
    }
    
    // 4. Try to find price in preloaded state (React hydration data)
    const stateMatch = html.match(/"amount"\s*:\s*(\d+(?:\.\d+)?)/i)
    if (stateMatch) {
      const price = parseFloat(stateMatch[1])
      if (!isNaN(price) && price > 100) {
        return { 
          price, 
          priceFormatted: formatPriceAR(price) 
        }
      }
    }
    
    return { price: null, priceFormatted: null, error: 'Price not found in HTML' }
    
  } catch (error) {
    return { 
      price: null, 
      priceFormatted: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Scrape prices for multiple URLs in parallel
 */
export async function scrapeMeliPrices(urls: string[], maxConcurrent = 3): Promise<Map<string, ScrapedPrice>> {
  const results = new Map<string, ScrapedPrice>()
  
  // Process in batches to avoid rate limiting
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent)
    const batchResults = await Promise.all(
      batch.map(async url => {
        const result = await scrapeMeliPrice(url)
        return { url, result }
      })
    )
    
    for (const { url, result } of batchResults) {
      results.set(url, result)
    }
    
    // Small delay between batches
    if (i + maxConcurrent < urls.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }
  
  return results
}

/**
 * Format price in Argentine format
 */
function formatPriceAR(price: number): string {
  return `$${price.toLocaleString('es-AR')}`
}
