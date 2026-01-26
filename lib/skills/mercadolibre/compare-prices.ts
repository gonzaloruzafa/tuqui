/**
 * Skill: compare_meli_prices
 *
 * Compara precios de productos similares en MercadoLibre.
 * Útil para análisis de mercado y decisiones de pricing.
 *
 * @example
 * User: "Comparar precios de iPhone 15 en MercadoLibre"
 * User: "¿Cuál es el rango de precios de notebooks Lenovo?"
 * User: "Estoy caro o barato con mi producto X?"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success } from '../types';
import { errorToResult } from '../errors';
import { MeliSearchClient, type MeliProduct } from './_client';

// ============================================
// INPUT SCHEMA
// ============================================

export const CompareMeliPricesInputSchema = z.object({
  /** Nombre del producto a comparar */
  productName: z
    .string()
    .min(1)
    .describe('Producto a comparar (ej: "iPhone 15", "Notebook Lenovo IdeaPad")'),

  /** Cantidad de productos a analizar */
  limit: z.number().int().min(3).max(20).default(10).describe('Cantidad de productos para el análisis'),
});

export type CompareMeliPricesInput = z.infer<typeof CompareMeliPricesInputSchema>;

// ============================================
// OUTPUT TYPES
// ============================================

export interface PriceComparison {
  /** Nombre del producto */
  productName: string;
  /** Precio mínimo encontrado */
  minPrice: number | null;
  /** Precio máximo encontrado */
  maxPrice: number | null;
  /** Precio promedio */
  avgPrice: number | null;
  /** Precio mediana */
  medianPrice: number | null;
  /** Rango de precios formateado */
  priceRange: string;
  /** Cantidad de productos analizados */
  sampleSize: number;
  /** Lista de productos */
  products: Array<{
    title: string;
    price: number | null;
    url: string;
  }>;
  /** Insights generados */
  insights: string;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const compareMeliPrices: Skill<
  typeof CompareMeliPricesInputSchema,
  PriceComparison
> = {
  name: 'compare_meli_prices',

  description: `Compara precios de productos similares en MercadoLibre.
Usa este skill cuando el usuario pregunte: "comparar precios de X", "rango de precios",
"cuál es el precio promedio de X", "estoy caro/barato", "precio mínimo y máximo de X".
Devuelve estadísticas: min, max, promedio, mediana y análisis.`,

  tool: 'mercadolibre',

  inputSchema: CompareMeliPricesInputSchema,

  tags: ['mercadolibre', 'comparison', 'pricing', 'market-analysis'],

  priority: 15, // Mayor prioridad que search para comparaciones

  async execute(
    input: CompareMeliPricesInput,
    context: SkillContext
  ): Promise<SkillResult<PriceComparison>> {
    try {
      // Buscar productos
      const result = await MeliSearchClient.searchProducts(input.productName, {
        limit: input.limit,
        useCache: true,
      });

      if (result.products.length === 0) {
        return success({
          productName: input.productName,
          minPrice: null,
          maxPrice: null,
          avgPrice: null,
          medianPrice: null,
          priceRange: 'No se encontraron productos',
          sampleSize: 0,
          products: [],
          insights: `No se encontraron productos de "${input.productName}" en MercadoLibre.`,
        });
      }

      // Calcular estadísticas
      const stats = MeliSearchClient.calculatePriceStats(result.products);

      // Formatear productos
      const products = result.products.map((p) => ({
        title: p.title,
        price: p.price,
        url: p.url,
      }));

      // Generar precio range
      const priceRange =
        stats.min && stats.max
          ? `${MeliSearchClient.formatPrice(stats.min)} - ${MeliSearchClient.formatPrice(stats.max)}`
          : 'Precios no disponibles';

      // Generar insights
      const insights = generateInsights(input.productName, stats, result.products.length);

      return success({
        productName: input.productName,
        minPrice: stats.min,
        maxPrice: stats.max,
        avgPrice: stats.avg,
        medianPrice: stats.median,
        priceRange,
        sampleSize: result.products.length,
        products,
        insights,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};

// ============================================
// HELPERS
// ============================================

function generateInsights(
  productName: string,
  stats: { min: number | null; max: number | null; avg: number | null; median: number | null },
  sampleSize: number
): string {
  if (!stats.avg || !stats.min || !stats.max) {
    return `Analicé ${sampleSize} productos de "${productName}" pero la mayoría no tienen precio visible.`;
  }

  const insights: string[] = [];

  // Precio promedio
  insights.push(
    `El precio promedio de "${productName}" en MercadoLibre es ${MeliSearchClient.formatPrice(stats.avg)} (basado en ${sampleSize} productos).`
  );

  // Rango
  const range = stats.max - stats.min;
  const rangePercent = Math.round((range / stats.avg) * 100);
  insights.push(
    `Los precios varían ${rangePercent}% entre el más barato (${MeliSearchClient.formatPrice(stats.min)}) y el más caro (${MeliSearchClient.formatPrice(stats.max)}).`
  );

  // Recomendación
  if (stats.median && stats.avg) {
    const medianDiff = Math.abs(stats.median - stats.avg);
    const medianDiffPercent = Math.round((medianDiff / stats.avg) * 100);

    if (medianDiffPercent > 15) {
      insights.push(
        `El precio mediano (${MeliSearchClient.formatPrice(stats.median)}) difiere ${medianDiffPercent}% del promedio, sugiriendo que hay productos muy caros que elevan el promedio.`
      );
    } else {
      insights.push(
        `El precio mediano (${MeliSearchClient.formatPrice(stats.median)}) está cerca del promedio, indicando una distribución equilibrada de precios.`
      );
    }
  }

  return insights.join(' ');
}
