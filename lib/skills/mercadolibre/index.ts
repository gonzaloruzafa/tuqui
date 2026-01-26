/**
 * MercadoLibre Skills
 *
 * Conjunto de skills especializados para búsqueda y análisis de productos
 * en MercadoLibre Argentina.
 *
 * DIFERENCIA CON WEB_SEARCH:
 * - web_search: herramienta genérica para cualquier búsqueda web
 * - MercadoLibre Skills: especializados para ecommerce con outputs tipados
 *
 * @example
 * // Antes (web_search):
 * await webSearchTool.execute({ query: "precios iphone 15 mercadolibre" })
 * // Output: Texto libre mezclado
 *
 * // Después (skills):
 * await searchMeliProducts.execute({ query: "iPhone 15", limit: 5 })
 * // Output: { products: [...], totalFound: 157, summary: "..." }
 */

export { searchMeliProducts } from './search-products';
export { compareMeliPrices } from './compare-prices';
export { getMeliPriceStatistics } from './get-price-statistics';

// Export types
export type { SearchMeliProductsInput, SearchMeliProductsOutput, ProductResult } from './search-products';
export type { CompareMeliPricesInput, PriceComparison } from './compare-prices';
export type { GetMeliPriceStatisticsInput, PriceStatistics } from './get-price-statistics';

// Export all skills as array (for loader)
import { searchMeliProducts } from './search-products';
import { compareMeliPrices } from './compare-prices';
import { getMeliPriceStatistics } from './get-price-statistics';

/**
 * Todos los skills de MercadoLibre
 * Organizados por caso de uso
 */
export const mercadolibreSkills = [
  // Búsqueda básica
  searchMeliProducts, // "Buscá iPhone 15 en MeLi"

  // Análisis de precios
  compareMeliPrices, // "Comparar precios de notebooks"
  getMeliPriceStatistics, // "Estadísticas de precios de aires acondicionados"
];

/**
 * Total: 3 skills
 *
 * Casos de uso cubiertos:
 * 1. Búsqueda de productos específicos
 * 2. Comparación de precios
 * 3. Análisis estadístico de mercado
 * 4. Segmentación de precios (gama baja/media/alta)
 */
