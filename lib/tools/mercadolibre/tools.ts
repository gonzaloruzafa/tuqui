import { tool } from 'ai'
import { z } from 'zod'
import { searchProducts } from './browser-client'
import { calculatePercentiles, MELI_SITE_LIST } from './schema'

export const searchTool = tool({
    description: 'Buscar productos en Mercado Libre (precios, links, imagenes)',
    parameters: z.object({
        query: z.string().describe('Producto a buscar'),
        site: z.enum(MELI_SITE_LIST as [string, ...string[]]).optional().default('MLA'),
        maxResults: z.number().optional().default(5)
    }),
    execute: async ({ query, site, maxResults }) => {
        return await searchProducts(query, site || 'MLA', maxResults)
    }
})

export const priceAnalysisTool = tool({
    description: 'Analizar precios de un producto (promedio, minimos, maximos)',
    parameters: z.object({
        query: z.string(),
        site: z.string().optional().default('MLA'),
        sampleSize: z.number().optional().default(10)
    }),
    execute: async ({ query, site, sampleSize }) => {
        const result = await searchProducts(query, site || 'MLA', sampleSize)
        if (!result.success || result.products.length === 0) {
            return { error: 'No se encontraron productos' }
        }

        const prices = result.products.map(p => p.price).filter(p => p > 0)
        const stats = calculatePercentiles(prices)

        return {
            stats,
            cheapest: result.products.sort((a, b) => a.price - b.price).slice(0, 3)
        }
    }
})

export const meliTools = {
    meli_search: searchTool,
    meli_price_analysis: priceAnalysisTool
}
