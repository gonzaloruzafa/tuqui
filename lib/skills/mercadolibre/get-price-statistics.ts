/**
 * Skill: get_meli_price_statistics
 *
 * Obtiene estadísticas detalladas de precios para un tipo de producto.
 * Útil para análisis de mercado y decisiones de pricing estratégico.
 *
 * @example
 * User: "Estadísticas de precios de notebooks gaming"
 * User: "Análisis de mercado de sillas ergonómicas"
 * User: "Distribución de precios de aire acondicionado"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success } from '../types';
import { errorToResult } from '../errors';
import { MeliSearchClient } from './_client';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetMeliPriceStatisticsInputSchema = z.object({
  /** Tipo de producto a analizar */
  productType: z
    .string()
    .min(1)
    .describe('Categoría o tipo de producto (ej: "notebooks gaming", "celulares gama media")'),

  /** Tamaño de muestra */
  sampleSize: z
    .number()
    .int()
    .min(5)
    .max(20)
    .default(15)
    .describe('Cantidad de productos para el análisis estadístico'),
});

export type GetMeliPriceStatisticsInput = z.infer<typeof GetMeliPriceStatisticsInputSchema>;

// ============================================
// OUTPUT TYPES
// ============================================

export interface PriceStatistics {
  /** Tipo de producto analizado */
  productType: string;

  /** Estadísticas de precios */
  statistics: {
    /** Precio mínimo */
    min: number | null;
    /** Precio máximo */
    max: number | null;
    /** Precio promedio */
    avg: number | null;
    /** Precio mediana */
    median: number | null;
  };

  /** Tamaño de la muestra */
  sampleSize: number;

  /** Distribución de precios (descripción textual) */
  priceDistribution: string;

  /** Análisis y recomendaciones */
  analysis: string;

  /** Rangos de precio (bajo, medio, alto) */
  priceRanges: {
    low: { min: number; max: number; label: string };
    medium: { min: number; max: number; label: string };
    high: { min: number; max: number; label: string };
  } | null;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getMeliPriceStatistics: Skill<
  typeof GetMeliPriceStatisticsInputSchema,
  PriceStatistics
> = {
  name: 'get_meli_price_statistics',

  description: `Obtiene estadísticas detalladas de precios en MercadoLibre.
Usa este skill para: "estadísticas de precios", "análisis de mercado",
"distribución de precios", "segmentación de precios".
Devuelve estadísticas completas y rangos de precio (bajo/medio/alto).`,

  tool: 'mercadolibre',

  inputSchema: GetMeliPriceStatisticsInputSchema,

  tags: ['mercadolibre', 'statistics', 'market-analysis', 'pricing-strategy'],

  priority: 12,

  async execute(
    input: GetMeliPriceStatisticsInput,
    context: SkillContext
  ): Promise<SkillResult<PriceStatistics>> {
    try {
      // Buscar productos
      const result = await MeliSearchClient.searchProducts(input.productType, {
        limit: input.sampleSize,
        useCache: true,
      });

      if (result.products.length === 0) {
        return success({
          productType: input.productType,
          statistics: { min: null, max: null, avg: null, median: null },
          sampleSize: 0,
          priceDistribution: 'No se encontraron productos para analizar.',
          analysis: `No se encontraron productos de tipo "${input.productType}" en MercadoLibre.`,
          priceRanges: null,
        });
      }

      // Calcular estadísticas
      const stats = MeliSearchClient.calculatePriceStats(result.products);

      // Generar distribución
      const distribution = generateDistribution(result.products, stats);

      // Generar análisis
      const analysis = generateAnalysis(input.productType, stats, result.products.length);

      // Calcular rangos de precio
      const priceRanges = calculatePriceRanges(stats);

      return success({
        productType: input.productType,
        statistics: stats,
        sampleSize: result.products.length,
        priceDistribution: distribution,
        analysis,
        priceRanges,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};

// ============================================
// HELPERS
// ============================================

function generateDistribution(
  products: any[],
  stats: { min: number | null; max: number | null; avg: number | null; median: number | null }
): string {
  if (!stats.min || !stats.max || !stats.avg) {
    return 'Distribución no disponible (precios insuficientes)';
  }

  const prices = products.map((p) => p.price).filter((p): p is number => p !== null);
  const range = stats.max - stats.min;
  const bucketSize = range / 3; // Dividir en 3 rangos: bajo, medio, alto

  const low = prices.filter((p) => p < stats.min! + bucketSize).length;
  const medium = prices.filter((p) => p >= stats.min! + bucketSize && p < stats.min! + bucketSize * 2).length;
  const high = prices.filter((p) => p >= stats.min! + bucketSize * 2).length;

  const total = prices.length;
  const lowPct = Math.round((low / total) * 100);
  const mediumPct = Math.round((medium / total) * 100);
  const highPct = Math.round((high / total) * 100);

  return `Distribución: ${lowPct}% gama baja, ${mediumPct}% gama media, ${highPct}% gama alta`;
}

function generateAnalysis(
  productType: string,
  stats: { min: number | null; max: number | null; avg: number | null; median: number | null },
  sampleSize: number
): string {
  if (!stats.avg || !stats.min || !stats.max) {
    return `Análisis limitado: solo ${sampleSize} productos con precio visible.`;
  }

  const analysis: string[] = [];

  analysis.push(
    `Analicé ${sampleSize} productos de "${productType}" en MercadoLibre.`
  );

  // Volatilidad del mercado
  const volatility = ((stats.max - stats.min) / stats.avg) * 100;
  if (volatility > 100) {
    analysis.push(
      `El mercado es ALTAMENTE VOLÁTIL (variación del ${Math.round(volatility)}%). Hay productos desde gama baja hasta premium.`
    );
  } else if (volatility > 50) {
    analysis.push(
      `El mercado tiene VARIACIÓN MODERADA (${Math.round(volatility)}%). Diferentes segmentos de precio coexisten.`
    );
  } else {
    analysis.push(
      `El mercado es ESTABLE (variación del ${Math.round(volatility)}%). Los precios están concentrados en un rango similar.`
    );
  }

  // Comparación median vs avg
  if (stats.median && stats.avg) {
    const skew = ((stats.avg - stats.median) / stats.avg) * 100;
    if (Math.abs(skew) > 15) {
      if (skew > 0) {
        analysis.push(
          `La distribución está SESGADA HACIA ARRIBA: hay productos muy caros que elevan el promedio (${MeliSearchClient.formatPrice(stats.avg)}) vs la mediana (${MeliSearchClient.formatPrice(stats.median)}).`
        );
      } else {
        analysis.push(
          `La distribución está SESGADA HACIA ABAJO: hay productos muy baratos que bajan el promedio vs la mediana.`
        );
      }
    } else {
      analysis.push(
        `La distribución es EQUILIBRADA: el promedio (${MeliSearchClient.formatPrice(stats.avg)}) y la mediana (${MeliSearchClient.formatPrice(stats.median)}) están alineados.`
      );
    }
  }

  return analysis.join(' ');
}

function calculatePriceRanges(stats: {
  min: number | null;
  max: number | null;
  avg: number | null;
  median: number | null;
}): PriceStatistics['priceRanges'] {
  if (!stats.min || !stats.max || !stats.avg) {
    return null;
  }

  const range = stats.max - stats.min;
  const bucketSize = range / 3;

  return {
    low: {
      min: stats.min,
      max: Math.round(stats.min + bucketSize),
      label: `Gama baja: ${MeliSearchClient.formatPrice(stats.min)} - ${MeliSearchClient.formatPrice(Math.round(stats.min + bucketSize))}`,
    },
    medium: {
      min: Math.round(stats.min + bucketSize),
      max: Math.round(stats.min + bucketSize * 2),
      label: `Gama media: ${MeliSearchClient.formatPrice(Math.round(stats.min + bucketSize))} - ${MeliSearchClient.formatPrice(Math.round(stats.min + bucketSize * 2))}`,
    },
    high: {
      min: Math.round(stats.min + bucketSize * 2),
      max: stats.max,
      label: `Gama alta: ${MeliSearchClient.formatPrice(Math.round(stats.min + bucketSize * 2))} - ${MeliSearchClient.formatPrice(stats.max)}`,
    },
  };
}
