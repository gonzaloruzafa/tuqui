/**
 * PriceComparator - Comparación automática de precios propios vs mercado
 *
 * Busca productos propios en MercadoLibre y genera recomendaciones accionables.
 * Detecta oportunidades de ajuste de precio basadas en posición competitiva.
 *
 * @example
 * const comparison = await PriceComparator.compareProduct({
 *   name: 'Turbina Gacela LED',
 *   price: 455000
 * })
 *
 * console.log(comparison.recommendation)
 * // "Estás 3.1% arriba del promedio. Considerar bajar precio."
 */

// ============================================
// TYPES
// ============================================

export interface ProductInfo {
  name: string
  price: number
  code?: string
  brand?: string
}

export interface MLCompetitor {
  title: string
  price: number
  url: string
  seller?: string
}

export interface PriceComparison {
  // Datos de entrada
  ownProduct: ProductInfo

  // Datos del mercado
  mlAverage: number
  mlMin: number
  mlMax: number
  mlMedian: number
  competitors: MLCompetitor[]
  competitorsCount: number

  // Análisis
  pricePosition: 'muy barato' | 'competitivo' | 'caro' | 'muy caro'
  percentilRank: number // 0-100, donde 100 es el más caro
  diffFromAverage: number // % diferencia con promedio (positivo = más caro)
  diffFromMin: number
  diffFromMax: number

  // Recomendación
  recommendation: string
  suggestedPrice?: number
  confidence: 'alta' | 'media' | 'baja'

  // Metadata
  searchQuery: string
  timestamp: string
}

// ============================================
// MAIN COMPARATOR CLASS
// ============================================

export class PriceComparator {
  /**
   * Compara un producto propio contra MercadoLibre
   */
  static async compareProduct(product: ProductInfo): Promise<PriceComparison | null> {
    // 1. Normalizar nombre para búsqueda
    const searchQuery = this.buildSearchQuery(product)
    console.log('[PriceComparator] Searching for:', searchQuery)

    // 2. Buscar en MercadoLibre (usando web search tool)
    // Nota: Este método asume que webSearchTool está disponible
    // En producción, esto se llamaría desde el contexto del agent
    const mlResults = await this.searchMercadoLibre(searchQuery)

    if (!mlResults || mlResults.length === 0) {
      console.warn('[PriceComparator] No results found in ML for:', searchQuery)
      return null
    }

    // 3. Filtrar productos similares (precio ±50%)
    const similar = mlResults.filter((p) => {
      const priceDiff = Math.abs(p.price - product.price) / product.price
      return priceDiff <= 0.5 // Dentro de ±50%
    })

    if (similar.length === 0) {
      console.warn('[PriceComparator] No similar products found')
      return null
    }

    // 4. Calcular estadísticas
    const prices = similar.map((p) => p.price).sort((a, b) => a - b)
    const mlAverage = this.average(prices)
    const mlMin = Math.min(...prices)
    const mlMax = Math.max(...prices)
    const mlMedian = this.median(prices)

    // 5. Calcular posición competitiva
    const percentilRank = this.calculatePercentile(product.price, prices)
    const pricePosition = this.determinePosition(percentilRank)
    const diffFromAverage = ((product.price - mlAverage) / mlAverage) * 100

    // 6. Generar recomendación
    const { recommendation, suggestedPrice, confidence } = this.generateRecommendation(
      product.price,
      mlAverage,
      mlMin,
      mlMax,
      percentilRank,
      similar.length
    )

    return {
      ownProduct: product,
      mlAverage,
      mlMin,
      mlMax,
      mlMedian,
      competitors: similar,
      competitorsCount: similar.length,
      pricePosition,
      percentilRank,
      diffFromAverage,
      diffFromMin: ((product.price - mlMin) / mlMin) * 100,
      diffFromMax: ((product.price - mlMax) / mlMax) * 100,
      recommendation,
      suggestedPrice,
      confidence,
      searchQuery,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Construye query de búsqueda optimizada para MercadoLibre
   */
  private static buildSearchQuery(product: ProductInfo): string {
    let query = product.name

    // Remover códigos internos [C001063]
    query = query.replace(/\[.*?\]/g, '')

    // Remover paréntesis con información secundaria
    query = query.replace(/\(.*?\)/g, '')

    // Extraer marca si está disponible
    if (product.brand) {
      query = `${product.brand} ${query}`
    }

    // Limpiar y normalizar
    query = query
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()

    return query
  }

  /**
   * Busca productos en MercadoLibre
   * Nota: En producción esto debería usar el webSearchTool del agente
   */
  private static async searchMercadoLibre(query: string): Promise<MLCompetitor[]> {
    // Esta función es un placeholder para la integración real
    // En producción, debería llamar al webSearchTool o a la API de ML
    console.warn('[PriceComparator] searchMercadoLibre is a placeholder - integrate with webSearchTool')

    // Placeholder: retornar array vacío
    // En producción, esto vendría del webSearchTool
    return []
  }

  /**
   * Calcula percentil de un precio en el set de precios
   * Retorna valor 0-100 donde 100 es el más caro
   */
  private static calculatePercentile(price: number, sortedPrices: number[]): number {
    const index = sortedPrices.findIndex((p) => p >= price)
    if (index === -1) return 100 // Más caro que todos
    return (index / sortedPrices.length) * 100
  }

  /**
   * Determina posición cualitativa basada en percentil
   */
  private static determinePosition(
    percentil: number
  ): 'muy barato' | 'competitivo' | 'caro' | 'muy caro' {
    if (percentil < 25) return 'muy barato'
    if (percentil < 50) return 'competitivo'
    if (percentil < 75) return 'caro'
    return 'muy caro'
  }

  /**
   * Genera recomendación de pricing
   */
  private static generateRecommendation(
    ownPrice: number,
    avgPrice: number,
    minPrice: number,
    maxPrice: number,
    percentil: number,
    sampleSize: number
  ): { recommendation: string; suggestedPrice?: number; confidence: 'alta' | 'media' | 'baja' } {
    const diffPercent = ((ownPrice - avgPrice) / avgPrice) * 100

    // Determinar confianza según tamaño de muestra
    let confidence: 'alta' | 'media' | 'baja'
    if (sampleSize >= 10) confidence = 'alta'
    else if (sampleSize >= 5) confidence = 'media'
    else confidence = 'baja'

    // Generar recomendación
    let recommendation: string
    let suggestedPrice: number | undefined

    if (diffPercent > 15) {
      // Muy caro (>15% arriba del promedio)
      suggestedPrice = Math.round(avgPrice * 1.05) // 5% arriba del promedio
      recommendation = `⚠️ Estás ${diffPercent.toFixed(1)}% arriba del promedio. Considerar bajar a $${suggestedPrice.toLocaleString('es-AR')} para ser más competitivo.`
    } else if (diffPercent > 5) {
      // Caro (5-15% arriba)
      recommendation = `📊 Estás ${diffPercent.toFixed(1)}% arriba del promedio. Precio aceptable pero podría ajustarse si las ventas bajan.`
    } else if (diffPercent < -15) {
      // Muy barato (<-15% abajo)
      suggestedPrice = Math.round(avgPrice * 0.95) // 5% abajo del promedio
      recommendation = `💰 Estás ${Math.abs(diffPercent).toFixed(1)}% abajo del promedio. Podrías subir a $${suggestedPrice.toLocaleString('es-AR')} y seguir competitivo.`
    } else if (diffPercent < -5) {
      // Barato (-5% a -15%)
      recommendation = `✅ Estás ${Math.abs(diffPercent).toFixed(1)}% abajo del promedio. Buena posición competitiva para captar volumen.`
    } else {
      // En línea con el mercado (-5% a +5%)
      recommendation = `✅ Precio en línea con el mercado (${diffPercent > 0 ? '+' : ''}${diffPercent.toFixed(1)}%). Posición equilibrada.`
    }

    // Agregar contexto de confianza
    if (confidence === 'baja') {
      recommendation += ` (⚠️ Muestra pequeña: ${sampleSize} productos)`
    }

    return { recommendation, suggestedPrice, confidence }
  }

  /**
   * Formatea comparación como texto legible
   */
  static formatComparison(comparison: PriceComparison): string {
    const { ownProduct, mlAverage, mlMin, mlMax, pricePosition, competitorsCount, recommendation } =
      comparison

    return `
## Análisis de Precio: ${ownProduct.name}

**Tu Precio:** $${ownProduct.price.toLocaleString('es-AR')}

**Mercado (${competitorsCount} competidores):**
- Promedio: $${mlAverage.toLocaleString('es-AR')}
- Mínimo: $${mlMin.toLocaleString('es-AR')}
- Máximo: $${mlMax.toLocaleString('es-AR')}

**Posición:** ${pricePosition.toUpperCase()} (percentil ${comparison.percentilRank.toFixed(0)})

**Recomendación:**
${recommendation}
    `.trim()
  }

  /**
   * Batch comparison: compara múltiples productos a la vez
   */
  static async compareProducts(products: ProductInfo[]): Promise<PriceComparison[]> {
    const results: PriceComparison[] = []

    for (const product of products) {
      const comparison = await this.compareProduct(product)
      if (comparison) {
        results.push(comparison)
      }
    }

    return results
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private static average(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length
  }

  private static median(sortedNumbers: number[]): number {
    const mid = Math.floor(sortedNumbers.length / 2)
    if (sortedNumbers.length % 2 === 0) {
      return (sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2
    }
    return sortedNumbers[mid]
  }
}
