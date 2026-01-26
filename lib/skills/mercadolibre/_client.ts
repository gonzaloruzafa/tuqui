/**
 * MercadoLibre Search Client
 *
 * Unified client for searching MercadoLibre using Serper + Tavily.
 * Used by MercadoLibre Skills to provide structured product data.
 */

import { MLCache } from '@/lib/mercadolibre/cache';
import { MLLinkValidator } from '@/lib/mercadolibre/link-validator';

// ============================================
// TYPES
// ============================================

export interface MeliProduct {
  id: string | null;           // MLA-123456
  title: string;
  price: number | null;
  currency: string;
  url: string;
  snippet: string;
  seller?: string | null;
}

export interface MeliSearchResult {
  products: MeliProduct[];
  totalFound: number;
  query: string;
  method: 'serper' | 'tavily' | 'hybrid';
  executionTime: number;
}

export interface SerperProduct {
  title: string;
  link: string;
  snippet?: string;
  price?: string;
}

// ============================================
// PRICE PARSER
// ============================================

/**
 * Extrae precio de un string
 * Ejemplos: "$ 123.456", "$123456", "ARS 123.456"
 */
export function parsePrice(text: string): number | null {
  if (!text) return null;

  // Remove common currency symbols and normalize
  const normalized = text
    .replace(/ARS|USD|$|,/gi, '')
    .replace(/\./g, '')  // Remove thousands separator (Argentina uses .)
    .trim();

  // Extract first number sequence
  const match = normalized.match(/(\d+)/);
  if (!match) return null;

  const price = parseInt(match[1], 10);
  return isNaN(price) ? null : price;
}

/**
 * Busca precio en snippet o título
 */
export function extractPriceFromText(text: string): number | null {
  // Patterns comunes de precio en ML
  const patterns = [
    /\$\s*([\d.]+)/,              // $ 123.456
    /([\d.]+)\s*pesos/i,          // 123.456 pesos
    /ARS\s*([\d.]+)/i,            // ARS 123.456
    /precio[:\s]*([\d.]+)/i,      // precio: 123.456
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const price = parsePrice(match[1] || match[0]);
      if (price) return price;
    }
  }

  return null;
}

// ============================================
// SERPER CLIENT
// ============================================

/**
 * Busca productos en MercadoLibre usando Serper (Google Search API)
 * Optimizado para encontrar URLs de productos directos
 */
export async function searchWithSerper(
  query: string,
  options: {
    limit?: number;
  } = {}
): Promise<MeliSearchResult> {
  const SERPER_API_KEY = process.env.SERPER_API_KEY;
  if (!SERPER_API_KEY) {
    throw new Error('SERPER_API_KEY no configurada');
  }

  const startTime = Date.now();
  const limit = options.limit || 5;

  // Optimizar query para productos directos
  const searchQuery = `${query} site:articulo.mercadolibre.com.ar OR site:mercadolibre.com.ar/p/`;

  console.log('[MeliClient/Serper] Searching:', searchQuery);

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: searchQuery,
      num: limit,
      gl: 'ar',
      hl: 'es',
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Serper error (${res.status}): ${error}`);
  }

  const data = await res.json();

  // Parsear resultados orgánicos
  const organic: SerperProduct[] = data.organic || [];

  const products: MeliProduct[] = organic
    .filter((r: SerperProduct) => MLLinkValidator.isProductURL(r.link))
    .map((r: SerperProduct) => {
      const productId = MLLinkValidator.extractProductId(r.link);
      const price = extractPriceFromText(r.snippet || r.title || '');

      return {
        id: productId,
        title: r.title,
        price,
        currency: 'ARS',
        url: r.link,
        snippet: r.snippet || '',
      };
    });

  return {
    products,
    totalFound: data.searchInformation?.totalResults || products.length,
    query,
    method: 'serper',
    executionTime: Date.now() - startTime,
  };
}

// ============================================
// TAVILY CLIENT
// ============================================

/**
 * Busca productos usando Tavily
 * Útil como fallback o para búsquedas más generales
 */
export async function searchWithTavily(
  query: string,
  options: {
    limit?: number;
  } = {}
): Promise<MeliSearchResult> {
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  if (!TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY no configurada');
  }

  const startTime = Date.now();
  const limit = options.limit || 5;

  const searchQuery = `${query} site:mercadolibre.com.ar`;

  console.log('[MeliClient/Tavily] Searching:', searchQuery);

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: searchQuery,
      search_depth: 'basic',
      max_results: limit,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Tavily error (${res.status}): ${error}`);
  }

  const data = await res.json();

  const products: MeliProduct[] = (data.results || [])
    .filter((r: any) => MLLinkValidator.isProductURL(r.url))
    .map((r: any) => {
      const productId = MLLinkValidator.extractProductId(r.url);
      const price = extractPriceFromText(r.content || r.title || '');

      return {
        id: productId,
        title: r.title,
        price,
        currency: 'ARS',
        url: r.url,
        snippet: r.content?.slice(0, 200) || '',
      };
    });

  return {
    products,
    totalFound: products.length,
    query,
    method: 'tavily',
    executionTime: Date.now() - startTime,
  };
}

// ============================================
// UNIFIED CLIENT
// ============================================

/**
 * Cliente principal para búsquedas en MercadoLibre
 * Usa Serper primero, Tavily como fallback
 */
export class MeliSearchClient {
  /**
   * Busca productos en MercadoLibre
   */
  static async searchProducts(
    query: string,
    options: {
      limit?: number;
      useCache?: boolean;
    } = {}
  ): Promise<MeliSearchResult> {
    const { limit = 5, useCache = true } = options;

    // Check cache
    if (useCache) {
      const cached = MLCache.get<MeliSearchResult>(query);
      if (cached) {
        console.log('[MeliClient] Cache HIT:', query);
        return cached;
      }
    }

    try {
      // Primary: Serper (mejores resultados para productos)
      const result = await searchWithSerper(query, { limit });

      // Cache result
      if (useCache && result.products.length > 0) {
        MLCache.set(query, result);
      }

      return result;
    } catch (serperError: any) {
      console.error('[MeliClient] Serper failed, trying Tavily:', serperError.message);

      // Fallback: Tavily
      try {
        const result = await searchWithTavily(query, { limit });

        if (useCache && result.products.length > 0) {
          MLCache.set(query, result);
        }

        return result;
      } catch (tavilyError: any) {
        console.error('[MeliClient] Tavily also failed:', tavilyError.message);
        throw new Error(`No se pudieron buscar productos: ${serperError.message}`);
      }
    }
  }

  /**
   * Calcula estadísticas de precios
   */
  static calculatePriceStats(products: MeliProduct[]): {
    min: number | null;
    max: number | null;
    avg: number | null;
    median: number | null;
  } {
    const prices = products.map((p) => p.price).filter((p): p is number => p !== null);

    if (prices.length === 0) {
      return { min: null, max: null, avg: null, median: null };
    }

    const sorted = prices.sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);

    const median =
      sorted.length % 2 === 0
        ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
        : sorted[Math.floor(sorted.length / 2)];

    return { min, max, avg, median };
  }

  /**
   * Formatea precio en pesos argentinos
   */
  static formatPrice(price: number | null): string {
    if (price === null) return 'Precio no disponible';
    return `$ ${price.toLocaleString('es-AR')}`;
  }
}
