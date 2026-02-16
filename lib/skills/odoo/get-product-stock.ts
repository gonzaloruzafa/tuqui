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
  /** Product template ID to aggregate stock of ALL variants */
  productTemplateId: z.number().int().positive().optional(),
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
  /** Unit of measure (e.g. "Unidad", "kg", "Litro") */
  uom: string;
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

  description: `Stock de productos usando stock.quant.
USAR CUANDO: "stock", "inventario", "cuánto tenemos", "stock disponible", "existencias".
Puede buscar por nombre o mostrar productos con stock bajo.
Para productos con VARIANTES: usar productTemplateId (obtenido de search_products.templateId)
para agregar stock de TODAS las variantes. Sin él, solo verás variantes individuales.`,

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
      if (input.productTemplateId) {
        // Resolve template to all variant IDs
        const variants = await odoo.searchRead<{ id: number }>(
          'product.product',
          [['product_tmpl_id', '=', input.productTemplateId]],
          { fields: ['id'] }
        );
        productIds = variants.map(v => v.id);
        if (productIds.length === 0) {
          return success({ _descripcion: 'Sin resultados de stock para el template buscado.', products: [], totalQuantity: 0, productCount: 0 });
        }
      } else if (input.productSearch) {
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
            _descripcion: 'Sin resultados de stock para el producto buscado.',
            products: [],
            totalQuantity: 0,
            productCount: 0,
          });
        }
        productIds = products.map(p => p.id);
      }

      // Build stock.quant domain — always filter internal locations
      // to exclude customer/supplier/transit virtual locations
      const domain: OdooDomain = [
        ['location_id.usage', '=', 'internal'],
      ];
      
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

      const products: ProductStockLevel[] = stockData.map((row: any) => ({
        productId: row.product_id?.[0] || 0,
        productName: row.product_id?.[1] || 'Sin nombre',
        quantity: row.quantity || 0,
        uom: uomMap.get(row.product_id?.[0]) || 'Unidad',
      }));

      const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);

      const _descripcion = `Stock de PRODUCTOS. ${products.length} productos, cantidad total: ${totalQuantity}. IMPORTANTE: estos son PRODUCTOS del inventario, NO son clientes ni vendedores.`;

      return success({
        _descripcion,
        products,
        totalQuantity,
        productCount: products.length,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
