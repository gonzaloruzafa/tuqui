/**
 * Skill: get_product_stock
 *
 * Retrieves stock level for one or more products.
 * Replaces the LLM-generated query for "stock", "inventory", etc.
 *
 * @example
 * User: "¿Cuánto stock tenemos del producto X?"
 * User: "Stock disponible"
 * User: "Inventario del almacén principal"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError, failure } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetProductStockInputSchema = z.object({
  /** Product ID (if querying specific product) */
  productId: z.number().positive().optional(),
  /** Product name/code search (partial match) */
  productSearch: z.string().min(1).optional(),
  /** Warehouse ID (filter by location) */
  warehouseId: z.number().positive().optional(),
  /** Only show products with stock below this quantity */
  lowStockThreshold: z.number().min(0).optional(),
  /** Maximum products to return */
  limit: z.number().min(1).max(100).default(20),
}).refine(
  (data) => data.productId !== undefined || data.productSearch !== undefined || data.lowStockThreshold !== undefined,
  { message: 'At least productId, productSearch, or lowStockThreshold must be provided' }
);

export type GetProductStockInput = z.infer<typeof GetProductStockInputSchema>;

// ============================================
// OUTPUT TYPES
// ============================================

export interface ProductStockLevel {
  /** Product ID */
  productId: number;
  /** Product display name */
  productName: string;
  /** Internal reference/SKU */
  productCode?: string;
  /** Available quantity */
  quantityAvailable: number;
  /** Reserved quantity */
  quantityReserved: number;
  /** Free quantity (available - reserved) */
  quantityFree: number;
  /** Unit of measure */
  uom: string;
  /** Stock value (if available) */
  stockValue?: number;
  /** Warehouse name (if filtered) */
  warehouseName?: string;
}

export interface GetProductStockOutput {
  /** Stock levels by product */
  products: ProductStockLevel[];
  /** Total quantity across all products */
  totalQuantity: number;
  /** Total stock value (if available) */
  totalValue?: number;
  /** Number of products */
  productCount: number;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getProductStock: Skill<
  typeof GetProductStockInputSchema,
  GetProductStockOutput
> = {
  name: 'get_product_stock',

  description: `Get stock levels for products.
Use when user asks: "stock", "inventory", "how many do we have",
"stock disponible", "inventario", "cuánto tenemos", "existencias".
Can search by product ID, name, or show low stock items.`,

  tool: 'odoo',

  inputSchema: GetProductStockInputSchema,

  tags: ['stock', 'inventory', 'products', 'warehouse'],

  priority: 10,

  async execute(
    input: GetProductStockInput,
    context: SkillContext
  ): Promise<SkillResult<GetProductStockOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      // Build product domain
      const productDomain: OdooDomain = [['type', '=', 'product']]; // Only stockable products

      if (input.productId) {
        productDomain.push(['id', '=', input.productId]);
      }

      if (input.productSearch) {
        // Search in name and default_code (OR condition)
        productDomain.push(
          '|',
          ['name', 'ilike', input.productSearch],
          ['default_code', 'ilike', input.productSearch]
        );
      }

      // Get products with stock info
      const products = await odoo.searchRead<{
        id: number;
        name: string;
        default_code: string | false;
        qty_available: number;
        virtual_available: number;
        uom_id: [number, string];
        standard_price: number;
      }>(
        'product.product',
        productDomain,
        {
          fields: [
            'name',
            'default_code',
            'qty_available',
            'virtual_available',
            'uom_id',
            'standard_price',
          ],
          limit: input.limit * 2, // Extra for filtering
          order: 'qty_available desc',
        }
      );

      if (products.length === 0) {
        if (input.productId) {
          return failure('NOT_FOUND', `Product with ID ${input.productId} not found`);
        }
        return success({
          products: [],
          totalQuantity: 0,
          productCount: 0,
        });
      }

      // Transform and filter results
      let stockLevels: ProductStockLevel[] = products.map((p) => {
        const quantityAvailable = p.qty_available || 0;
        // virtual_available includes incoming - outgoing, so reserved = available - virtual (simplified)
        const quantityFree = p.virtual_available || 0;
        const quantityReserved = Math.max(0, quantityAvailable - quantityFree);

        return {
          productId: p.id,
          productName: p.name,
          productCode: p.default_code || undefined,
          quantityAvailable,
          quantityReserved,
          quantityFree,
          uom: p.uom_id?.[1] || 'Units',
          stockValue: p.standard_price ? quantityAvailable * p.standard_price : undefined,
        };
      });

      // Filter by low stock threshold
      if (input.lowStockThreshold !== undefined) {
        stockLevels = stockLevels.filter(
          (p) => p.quantityAvailable <= input.lowStockThreshold!
        );
      }

      // Apply final limit
      stockLevels = stockLevels.slice(0, input.limit);

      // Calculate totals
      const totalQuantity = stockLevels.reduce((sum, p) => sum + p.quantityAvailable, 0);
      const totalValue = stockLevels.reduce(
        (sum, p) => sum + (p.stockValue || 0),
        0
      );

      return success({
        products: stockLevels,
        totalQuantity,
        totalValue: totalValue > 0 ? totalValue : undefined,
        productCount: stockLevels.length,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
