/**
 * Skill: search_meli_products
 *
 * Busca productos en MercadoLibre Argentina.
 *
 * @example
 * User: "Buscá precios de iPhone 15 en Mercado Libre"
 * User: "Cuánto sale una notebook Lenovo en MeLi"
 * User: "Precios de sillas de oficina"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success } from '../types';
import { errorToResult } from '../errors';
import { MeliSearchClient, type MeliProduct } from './_client';

// ============================================
// INPUT SCHEMA
// ============================================

export const SearchMeliProductsInputSchema = z.object({
  /** Términos de búsqueda del producto */
  query: z.string().min(1).describe('Producto a buscar (ej: "iPhone 15", "sillón odontológico")'),

  /** Cantidad de resultados */
  limit: z.number().int().min(1).max(20).default(5).describe('Cantidad de productos a devolver'),

  /** Ordenamiento */
  sortBy: z
    .enum(['price_asc', 'price_desc', 'relevance'])
    .default('relevance')
    .describe('Orden de resultados'),
});

export type SearchMeliProductsInput = z.infer<typeof SearchMeliProductsInputSchema>;

// ============================================
// OUTPUT TYPES
// ============================================

export interface ProductResult {
  /** ID del producto (MLA-123456) */
  id: string | null;
  /** Título del producto */
  title: string;
  /** Precio en pesos argentinos */
  price: number | null;
  /** Precio formateado */
  priceFormatted: string;
  /** URL del producto */
  url: string;
  /** Descripción corta */
  snippet: string;
}

export interface SearchMeliProductsOutput {
  /** Lista de productos encontrados */
  products: ProductResult[];
  /** Total de productos encontrados (aproximado) */
  totalFound: number;
  /** Query original */
  query: string;
  /** Resumen textual */
  summary: string;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const searchMeliProducts: Skill<
  typeof SearchMeliProductsInputSchema,
  SearchMeliProductsOutput
> = {
  name: 'search_meli_products',

  description: `Busca productos en MercadoLibre Argentina.
Usa este skill cuando el usuario pida: "precios de [producto]", "buscar en mercadolibre",
"cuánto cuesta/sale/vale [producto] en meli", "productos similares a".
Devuelve lista de productos con precios, títulos y links.`,

  tool: 'mercadolibre',

  inputSchema: SearchMeliProductsInputSchema,

  tags: ['mercadolibre', 'search', 'products', 'prices'],

  priority: 10,

  async execute(
    input: SearchMeliProductsInput,
    context: SkillContext
  ): Promise<SkillResult<SearchMeliProductsOutput>> {
    try {
      // Buscar productos
      const result = await MeliSearchClient.searchProducts(input.query, {
        limit: input.limit,
        useCache: true,
      });

      // Ordenar productos
      let products = result.products;
      if (input.sortBy === 'price_asc') {
        products = products.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
      } else if (input.sortBy === 'price_desc') {
        products = products.sort((a, b) => (b.price || 0) - (a.price || 0));
      }

      // Formatear productos
      const formattedProducts: ProductResult[] = products.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        priceFormatted: MeliSearchClient.formatPrice(p.price),
        url: p.url,
        snippet: p.snippet,
      }));

      // Generar resumen
      const productsWithPrice = formattedProducts.filter((p) => p.price !== null);
      const summary =
        productsWithPrice.length > 0
          ? `Encontré ${formattedProducts.length} producto${formattedProducts.length !== 1 ? 's' : ''} de "${input.query}" en MercadoLibre. ` +
            `Los precios van desde ${MeliSearchClient.formatPrice(Math.min(...productsWithPrice.map((p) => p.price!)))} ` +
            `hasta ${MeliSearchClient.formatPrice(Math.max(...productsWithPrice.map((p) => p.price!)))}.`
          : `Encontré ${formattedProducts.length} producto${formattedProducts.length !== 1 ? 's' : ''} de "${input.query}" en MercadoLibre.`;

      return success({
        products: formattedProducts,
        totalFound: result.totalFound,
        query: input.query,
        summary,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
