/**
 * Skill: get_low_stock_products
 *
 * Get products with low stock levels.
 *
 * Use cases:
 * - "¿Qué productos tienen poco stock?"
 * - "Productos para reabastecer"
 * - "Stock bajo"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetLowStockProductsInputSchema = z.object({
  /** Stock threshold (products below this qty) */
  threshold: z.number().min(0).default(10),

  /** Maximum number of products to return */
  limit: z.number().int().min(1).max(100).default(20),

  /** Only stockable products */
  stockableOnly: z.boolean().default(true),
});

// ============================================
// OUTPUT TYPE
// ============================================

export interface LowStockProduct {
  productId: number;
  productName: string;
  productCode: string | null;
  qtyAvailable: number;
  virtualAvailable: number;
  reorderingRule: boolean;
}

export interface LowStockProductsOutput {
  products: LowStockProduct[];
  total: number;
  threshold: number;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getLowStockProducts: Skill<
  typeof GetLowStockProductsInputSchema,
  LowStockProductsOutput
> = {
  name: 'get_low_stock_products',
  description: `Productos con poco stock - inventario bajo y crítico. HERRAMIENTA PRINCIPAL para stock.
Use for: "qué productos tienen poco stock", "stock bajo", "productos con bajo inventario",
"bajo stock", "productos agotados", "stock crítico", "reposición". Devuelve producto, cantidad disponible.`,
  tool: 'odoo',
  tags: ['inventory', 'stock', 'purchasing'],
  inputSchema: GetLowStockProductsInputSchema,

  async execute(input, context): Promise<SkillResult<LowStockProductsOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      // Build domain - only filter by stockable, not by qty (qty_available is computed)
      const domain: OdooDomain = [];

      if (input.stockableOnly) {
        domain.push(['type', '=', 'product']);
      }

      // Search for stockable products and read their quantities
      // We fetch more and filter client-side since qty_available is computed, not stored
      const products = await odoo.searchRead<{
        id: number;
        name: string;
        default_code: string | false;
        qty_available: number;
        virtual_available: number;
      }>(
        'product.product',
        domain,
        {
          fields: [
            'name',
            'default_code',
            'qty_available',
            'virtual_available',
          ],
          limit: 500, // Fetch more to filter client-side
          // Note: cannot order by qty_available as it's a computed field
        }
      );

      // Filter by threshold client-side, sort, and limit
      const lowStock = products
        .filter((p) => p.qty_available <= input.threshold)
        .sort((a, b) => a.qty_available - b.qty_available)  // Sort by qty ascending
        .slice(0, input.limit);

      // Transform results
      const results: LowStockProduct[] = lowStock.map((p) => ({
        productId: p.id,
        productName: p.name,
        productCode: p.default_code || null,
        qtyAvailable: p.qty_available,
        virtualAvailable: p.virtual_available,
        reorderingRule: false, // Would need additional query to check orderpoint rules
      }));

      const _descripcion = `Productos con stock bajo (umbral ≤ ${input.threshold} unidades): ${results.length} producto(s) encontrado(s). ${results.length > 0 ? `El más crítico es "${results[0].productName}" con ${results[0].qtyAvailable} unidades.` : 'No hay productos bajo el umbral.'} IMPORTANTE: son PRODUCTOS del inventario, NO son clientes ni vendedores.`;

      return success({
        _descripcion,
        products: results,
        total: results.length,
        threshold: input.threshold,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
