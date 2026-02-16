/**
 * Skill: get_top_stock_products
 *
 * Get products with the highest stock quantity using stock.quant model.
 * Note: product.product.qty_available is a computed field and cannot be used
 * for ordering or filtering in SQL. We use stock.quant with read_group instead.
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

export const GetTopStockProductsInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  locationId: z.number().int().optional().describe('Filtrar por ubicación específica'),
});

export interface TopStockProduct {
  productId: number;
  productName: string;
  quantity: number;
  /** Unit of measure (e.g. "Unidad", "kg", "Litro") */
  uom: string;
}

export interface TopStockProductsOutput {
  products: TopStockProduct[];
  totalProducts: number;
  totalQuantity: number;
}

export const getTopStockProducts: Skill<
  typeof GetTopStockProductsInputSchema,
  TopStockProductsOutput
> = {
  name: 'get_top_stock_products',
  description: `Productos con más stock - lista ordenada por cantidad disponible.
Use for: "productos con más stock", "qué tenemos más", "mayor inventario", "top stock".
Devuelve los productos ordenados de mayor a menor cantidad en stock.
Usa stock.quant (modelo real de stock) agrupado por producto.`,
  tool: 'odoo',
  tags: ['inventory', 'stock', 'products', 'reporting'],
  inputSchema: GetTopStockProductsInputSchema,

  async execute(input, context): Promise<SkillResult<TopStockProductsOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      // Build domain for stock.quant — always filter internal locations
      // to exclude customer/supplier/transit virtual locations
      const domain: OdooDomain = [
        ['quantity', '>', 0],
        ['location_id.usage', '=', 'internal'],
      ];
      
      if (input.locationId) {
        domain.push(['location_id', '=', input.locationId]);
      }

      // Use read_group on stock.quant to get aggregated stock by product
      const stockData = await odoo.readGroup(
        'stock.quant',
        domain,
        ['product_id', 'quantity:sum'],
        ['product_id'],
        { limit: input.limit, orderBy: 'quantity desc' }
      );

      // Get product IDs to fetch UoM
      const resultProductIds = stockData.map((row: any) => row.product_id?.[0]).filter(Boolean);

      // Fetch UoM for each product
      const uomMap = new Map<number, string>();
      if (resultProductIds.length > 0) {
        const productData = await odoo.searchRead<{
          id: number;
          uom_id: [number, string];
        }>(
          'product.product',
          [['id', 'in', resultProductIds]],
          { fields: ['id', 'uom_id'] }
        );
        for (const p of productData) {
          uomMap.set(p.id, p.uom_id?.[1] || 'Unidad');
        }
      }

      const products: TopStockProduct[] = stockData.map((row: any) => ({
        productId: row.product_id?.[0] || 0,
        productName: row.product_id?.[1] || 'Sin nombre',
        quantity: row.quantity || 0,
        uom: uomMap.get(row.product_id?.[0]) || 'Unidad',
      }));

      const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);

      const _descripcion = `Top ${products.length} producto(s) con mayor stock: ${totalQuantity} unidades totales.${products.length > 0 ? ` #1: "${products[0].productName}" con ${products[0].quantity} ${products[0].uom}.` : ''}${input.locationId ? ` Filtrado por ubicación ID ${input.locationId}.` : ''} IMPORTANTE: son PRODUCTOS del inventario, NO son clientes.`;

      return success({
        _descripcion,
        products,
        totalProducts: products.length,
        totalQuantity,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
