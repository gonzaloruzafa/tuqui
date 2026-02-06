/**
 * MercadoLibre Search Skill
 *
 * Búsqueda de productos usando Serper (Google Search API)
 * Retorna URLs de productos (/articulo/) no de listados (/listado/)
 */

import { MLLinkValidator } from './_validator'
import { MLCache } from './_cache'
import { extractPriceFromText, formatPrice, type MeliProduct, type MeliSearchResult } from './types'

/**
 * Skill: Buscar productos en MercadoLibre con Serper
 *
 * Serper es mejor que Tavily para MercadoLibre porque:
 * - Permite búsquedas site: precisas
 * - Devuelve URLs de /articulo/ (productos) no /listado/ (categorías)
 * - Detecta precios automáticamente en algunos casos
 */
export async function searchMeliWithSerper(
  query: string,
  options: {
    maxResults?: number
    useCache?: boolean
  } = {}
): Promise<MeliSearchResult> {
  const { maxResults = 5, useCache = true } = options

  // Check cache
  const cacheKey = `meli:serper:${query}`
  if (useCache) {
    const cached = MLCache.get<MeliSearchResult>(cacheKey)
    if (cached) {
      console.log('[MeliSkill/Serper] Cache HIT:', query)
      return { ...cached, cacheHit: true }
    }
  }

  const SERPER_API_KEY = process.env.SERPER_API_KEY
  if (!SERPER_API_KEY) {
    throw new Error('SERPER_API_KEY no configurada')
  }

  // Query optimizada para productos directos (no listados)
  const searchQuery = `${query} site:articulo.mercadolibre.com.ar OR site:mercadolibre.com.ar/p/`

  console.log('[MeliSkill/Serper] Searching:', searchQuery)

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: searchQuery,
      num: maxResults,
      gl: 'ar',
      hl: 'es',
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Serper error (${res.status}): ${error}`)
  }

  const data = await res.json()
  const organic = data.organic || []

  console.log('[MeliSkill/Serper] Found', organic.length, 'results')

  // Parse and filter valid product URLs with improved logic
  const products: MeliProduct[] = organic
    .filter((r: any) => {
      const isProduct = MLLinkValidator.isProductURL(r.link)
      const hasTitle = !!r.title
      return isProduct && hasTitle
    })
    .map((r: any) => {
      // Try to find price in snippet, then title
      let price = extractPriceFromText(r.snippet || '')
      if (!price) price = extractPriceFromText(r.title || '')

      // Basic cleanup for titles (remove site name)
      const cleanTitle = r.title.replace(/\| Mercado Libre.*/i, '').trim()

      return {
        id: MLLinkValidator.extractProductId(r.link),
        title: cleanTitle,
        url: r.link,
        snippet: r.snippet || '',
        price,
        priceFormatted: formatPrice(price),
      }
    })
    // Sort products that HAVE price first
    .sort((a: any, b: any) => (b.price ? 1 : 0) - (a.price ? 1 : 0))

  const result: MeliSearchResult = {
    products,
    query,
    method: 'serper',
    cacheHit: false,
  }

  // Cache result
  if (useCache && products.length > 0) {
    MLCache.set(cacheKey, result)
  }

  return result
}
