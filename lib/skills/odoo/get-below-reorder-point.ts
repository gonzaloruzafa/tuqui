/**
 * Skill: get_below_reorder_point
 *
 * Finds products that are below their configured reorder point (punto de pedido)
 * by querying stock.warehouse.orderpoint and comparing qty_to_order > 0.
 *
 * @example
 * User: "¿Qué productos están debajo del punto de pedido?"
 * User: "Productos para reponer"
 * User: "¿Qué tengo que comprar?"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetBelowReorderPointInputSchema = z.object({
  /** Filter by product name (partial match) */
  product_search: z.string().min(1).optional()
    .describe('Filtrar por nombre de producto'),

  /** Filter by warehouse name (partial match) */
  warehouse_search: z.string().min(1).optional()
    .describe('Filtrar por nombre de depósito/almacén'),

  /** Max results */
  limit: z.number().int().min(1).max(100).default(30),
});

// ============================================
// OUTPUT TYPES
// ============================================

export interface ReorderPointProduct {
  orderpointId: number;
  productId: number;
  productName: string;
  productCode: string | null;
  warehouseName: string;
  /** Current on-hand quantity */
  qtyOnHand: number;
  /** Forecasted quantity (on hand + incoming - outgoing) */
  qtyForecast: number;
  /** Minimum stock level (reorder point) */
  productMinQty: number;
  /** Maximum stock level */
  productMaxQty: number;
  /** Quantity to order to reach max */
  qtyToOrder: number;
}

export interface BelowReorderPointOutput {
  _descripcion?: string;
  products: ReorderPointProduct[];
  total: number;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getBelowReorderPoint: Skill<
  typeof GetBelowReorderPointInputSchema,
  BelowReorderPointOutput
> = {
  name: 'get_below_reorder_point',
  description: `Productos debajo del punto de pedido (reglas de reabastecimiento).
USAR CUANDO: "punto de pedido", "debajo del mínimo", "qué tengo que comprar", "productos para reponer",
"reglas de reabastecimiento", "orderpoint", "qué falta pedir", "stock debajo del mínimo".
RETORNA: producto, stock actual, stock previsto, mínimo configurado, cantidad a pedir, depósito.`,
  tool: 'odoo',
  tags: ['inventory', 'stock', 'purchasing'],
  inputSchema: GetBelowReorderPointInputSchema,

  async execute(input, context): Promise<SkillResult<BelowReorderPointOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      // Query stock.warehouse.orderpoint where qty_to_order > 0
      const domain: OdooDomain = [
        ['qty_to_order', '>', 0],
      ];

      if (input.product_search) {
        domain.push(['product_id.name', 'ilike', input.product_search]);
      }

      if (input.warehouse_search) {
        domain.push(['warehouse_id.name', 'ilike', input.warehouse_search]);
      }

      const orderpoints = await odoo.searchRead<{
        id: number;
        product_id: [number, string];
        product_min_qty: number;
        product_max_qty: number;
        qty_on_hand: number;
        qty_forecast: number;
        qty_to_order: number;
        warehouse_id: [number, string] | false;
      }>(
        'stock.warehouse.orderpoint',
        domain,
        {
          fields: [
            'product_id',
            'product_min_qty',
            'product_max_qty',
            'qty_on_hand',
            'qty_forecast',
            'qty_to_order',
            'warehouse_id',
          ],
          limit: input.limit,
          order: 'qty_to_order desc',
        }
      );

      const products: ReorderPointProduct[] = orderpoints.map((op) => ({
        orderpointId: op.id,
        productId: op.product_id[0],
        productName: op.product_id[1],
        productCode: null, // orderpoint doesn't have default_code directly
        warehouseName: op.warehouse_id ? op.warehouse_id[1] : 'Sin depósito',
        qtyOnHand: op.qty_on_hand,
        qtyForecast: op.qty_forecast,
        productMinQty: op.product_min_qty,
        productMaxQty: op.product_max_qty,
        qtyToOrder: op.qty_to_order,
      }));

      const _descripcion = `${products.length} producto(s) debajo del punto de pedido. ${
        products.length > 0
          ? `El más urgente es "${products[0].productName}" con ${products[0].qtyOnHand} en stock (mínimo: ${products[0].productMinQty}, pedir: ${products[0].qtyToOrder}).`
          : 'Todos los productos están por encima de su punto de pedido.'
      }`;

      return success({
        _descripcion,
        products,
        total: products.length,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
