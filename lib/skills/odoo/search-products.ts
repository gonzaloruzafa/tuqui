/**
 * Skill: search_products
 *
 * Search for products by name, code, or barcode.
 *
 * Use cases:
 * - "Buscar producto Notebook"
 * - "Producto con código PROD-001"
 * - "¿Tenemos stock de Mouse Logitech?"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const SearchProductsInputSchema = z.object({
  /** Search query (name, code, barcode) */
  query: z.string().min(1),

  /** Maximum number of results */
  limit: z.number().int().min(1).max(50).default(10),

  /** Include stock information */
  includeStock: z.boolean().default(true),

  /** Only saleable products */
  saleableOnly: z.boolean().default(false),

  /** Only products published on the website */
  publishedOnly: z.boolean().default(false),
});

// ============================================
// OUTPUT TYPE
// ============================================

export interface ProductResult {
  id: number;
  name: string;
  code: string | null;
  barcode: string | null;
  type: string;
  listPrice: number;
  standardPrice: number;
  qtyAvailable?: number;
  virtualAvailable?: number;
  uom: string;
  /** Whether the product is published on the website */
  isPublished: boolean;
  /** Product template ID (groups all variants of the same product) */
  templateId: number;
  /** Product template name (shared across variants) */
  templateName: string;
}

export interface SearchProductsOutput {
  products: ProductResult[];
  total: number;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const searchProducts: Skill<
  typeof SearchProductsInputSchema,
  SearchProductsOutput
> = {
  name: 'search_products',
  description: `Busca productos en Odoo por nombre, código o código de barras. HERRAMIENTA PRINCIPAL para buscar.
USAR PARA: "buscar productos con X", "encontrar producto", "producto que contenga", "buscar cable",
"productos con nombre X", "qué productos tenemos con", "buscar en productos".
Soporta publishedOnly para filtrar solo productos publicados en la web (ePublish/is_published).
Devuelve: nombre, código, precio, stock, isPublished, templateId (para agrupar variantes).
Si un producto tiene variantes (ej: distintos tamaños), el templateId es el mismo para todas.
Para ver ventas agregadas de TODAS las variantes, usar el templateId con get_product_sales_history.`,
  tool: 'odoo',
  tags: ['products', 'search', 'inventory'],
  inputSchema: SearchProductsInputSchema,

  async execute(input, context): Promise<SkillResult<SearchProductsOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      // Build search domain
      const domain: OdooDomain = [
        '|',
        '|',
        ['name', 'ilike', input.query],
        ['default_code', 'ilike', input.query],
        ['barcode', 'ilike', input.query],
      ];

      if (input.saleableOnly) {
        domain.push(['sale_ok', '=', true]);
      }

      if (input.publishedOnly) {
        domain.push(['is_published', '=', true]);
      }

      // Define fields
      const fields = [
        'name',
        'default_code',
        'barcode',
        'type',
        'list_price',
        'standard_price',
        'uom_id',
        'is_published',
        'product_tmpl_id',
      ];

      if (input.includeStock) {
        fields.push('qty_available', 'virtual_available');
      }

      // Search
      const products = await odoo.searchRead<{
        id: number;
        name: string;
        default_code: string | false;
        barcode: string | false;
        type: string;
        list_price: number;
        standard_price: number;
        qty_available?: number;
        virtual_available?: number;
        uom_id: [number, string];
        is_published: boolean;
        product_tmpl_id: [number, string];
      }>(
        'product.product',
        domain,
        {
          fields,
          limit: input.limit,
        }
      );

      // Transform results
      const results: ProductResult[] = products.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.default_code || null,
        barcode: p.barcode || null,
        type: p.type,
        listPrice: p.list_price,
        standardPrice: p.standard_price,
        qtyAvailable: p.qty_available,
        virtualAvailable: p.virtual_available,
        uom: p.uom_id[1],
        isPublished: p.is_published || false,
        templateId: p.product_tmpl_id?.[0] || 0,
        templateName: p.product_tmpl_id?.[1] || p.name,
      }));

      const _descripcion = `Búsqueda de productos "${input.query}": ${results.length} resultados encontrados${results.length > 0 ? `. Primeros: ${results.slice(0, 3).map(p => `${p.name}${p.code ? ` [${p.code}]` : ''}`).join(', ')}` : ''}. IMPORTANTE: son PRODUCTOS del catálogo, NO son clientes ni vendedores.`;

      return success({
        _descripcion,
        products: results,
        total: results.length,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
