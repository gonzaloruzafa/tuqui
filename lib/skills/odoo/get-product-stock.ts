/**
 * Skill: get_product_stock
 *
 * Retrieves stock level for one or more products using stock.quant model.
 * Note: product.product.qty_available is a computed field and cannot be used
 * for ordering or filtering. We use stock.quant which has real stock data.
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
  /** Product name/code search (partial match) */
  productSearch: z.string().min(1).optional(),
  /** Location ID (filter by warehouse/location) */
  locationId: z.number().positive().optional(),
  /** Only show products with stock below this quantity */
  lowStockThreshold: z.number().min(0).optional(),
  /** Maximum products to return */
  limit: z.number().min(1).max(100).default(20),
});

export type GetProductStockInput = z.infer<typeof GetProductStockInputSchema>;

// ============================================
// OUTPUT TYPES
// ============================================

export interface ProductStockLevel {
  /** Product ID */
  productId: number;
  /** Product display name */
  productName: string;
  /** Available quantity */
  quantity: number;
  /** Location name (if filtered) */
  locationName?: string;
}

export interface GetProductStockOutput {
  /** Stock levels by product */
  products: ProductStockLevel[];
  /** Total quantity across all products */
  totalQuantity: number;
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

  description: `Get stock levels for products using stock.quant model.
Use when user asks: "stock", "inventory", "how many do we have",
"stock disponible", "inventario", "cuánto tenemos", "existencias".
Can search by product name or show low stock items.`,

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

      // If searching by product name, first find matching products
      let productIds: number[] | undefined;
      if (input.productSearch) {
        const products = await odoo.searchRead<{ id: number; name: string }>(
          'product.product',
          [
            '|',
            ['name', 'ilike', input.productSearch],
            ['default_code', 'ilike', input.productSearch],
          ],
          { fields: ['id', 'name'], limit: 50 }
        );
        
        if (products.length === 0) {
          return success({
            products: [],
            totalQuantity: 0,
            productCount: 0,
          });
        }
        productIds = products.map(p => p.id);
      }

      // Build stock.quant domain
      const domain: OdooDomain = [];
      
      // Filter by products if searching
      if (productIds?.length) {
        domain.push(['product_id', 'in', productIds]);
      }
      
      // Filter by location if specified
      if (input.locationId) {
        domain.push(['location_id', '=', input.locationId]);
      }

      // For low stock, we need quantity > 0 OR to show all
      if (input.lowStockThreshold !== undefined) {
        domain.push(['quantity', '<=', input.lowStockThreshold]);
        domain.push(['quantity', '>=', 0]); // Don't show negative
      } else {
        domain.push(['quantity', '>', 0]);
      }

      // Use read_group to aggregate by product
      const stockData = await odoo.readGroup(
        'stock.quant',
        domain,
        ['product_id', 'quantity:sum'],
        ['product_id'],
        { limit: input.limit, orderBy: 'quantity desc' }
      );

      const products: ProductStockLevel[] = stockData.map((row: any) => ({
        productId: row.product_id?.[0] || 0,
        productName: row.product_id?.[1] || 'Sin nombre',
        quantity: row.quantity || 0,
      }));

      const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);

      return success({
        products,
        totalQuantity,
        productCount: products.length,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
