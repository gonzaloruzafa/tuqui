/**
 * Skill: get_top_products
 *
 * Get top-selling products by revenue or quantity.
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod, formatMonto } from './_client';
import { errorToResult } from '../errors';

export const GetTopProductsInputSchema = z.object({
  period: PeriodSchema.optional(),
  limit: z.number().int().min(1).max(50).default(10),
  orderBy: z.enum(['revenue', 'quantity']).default('revenue'),
  /** Filter by sales team ID (e.g., ecommerce, tienda web) */
  teamId: z.number().int().positive().optional(),
});

export interface TopProduct {
  productId: number;
  productName: string;
  quantitySold: number;
  /** Revenue with taxes */
  revenueWithTax: number;
  /** Revenue without taxes */
  revenueWithoutTax: number;
}

export interface TopProductsOutput {
  products: TopProduct[];
  totalRevenueWithTax: number;
  totalRevenueWithoutTax: number;
  totalQuantity: number;
  period: z.infer<typeof PeriodSchema>;
}

export const getTopProducts: Skill<
  typeof GetTopProductsInputSchema,
  TopProductsOutput
> = {
  name: 'get_top_products',
  description: `Top productos por ventas. EJECUTAR SIN PREGUNTAR PERÍODO (usa mes actual por defecto).
Para: "productos más vendidos", "qué se vende más", "ranking de productos", "productos estrella".
Soporta filtro por equipo (teamId). SIEMPRE llamar get_sales_teams primero para obtener el ID.`,
  tool: 'odoo',
  tags: ['sales', 'products', 'reporting'],
  inputSchema: GetTopProductsInputSchema,

  async execute(input, context): Promise<SkillResult<TopProductsOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      // sale.order.line doesn't have date_order or state directly
      // Must use order_id.date_order and order_id.state
      const domain = combineDomains(
        dateRange('order_id.date_order', period.start, period.end),
        [['order_id.state', 'in', ['sale', 'done']]]
      );

      // Filter by sales team if specified (via order)
      if (input.teamId) {
        domain.push(['order_id.team_id', '=', input.teamId]);
      }

      const orderByField = input.orderBy === 'revenue' ? 'price_total' : 'product_uom_qty';

      const grouped = await odoo.readGroup(
        'sale.order.line',
        domain,
        ['product_id', 'product_uom_qty:sum', 'price_total:sum', 'price_subtotal:sum'],
        ['product_id'],
        { limit: input.limit, orderBy: `${orderByField} desc` }
      );

      const products: TopProduct[] = grouped
        .filter((g) => g.product_id && Array.isArray(g.product_id))
        .map((g) => ({
          productId: (g.product_id as [number, string])[0],
          productName: (g.product_id as [number, string])[1],
          quantitySold: g.product_uom_qty || 0,
          revenueWithTax: g.price_total || 0,
          revenueWithoutTax: g.price_subtotal || 0,
        }));

      const _totalRev = products.reduce((sum, p) => sum + p.revenueWithTax, 0);
      const _top = products[0];
      const _descripcion = `Top PRODUCTOS más vendidos. ${products.length} productos.${_top ? ` #1: ${_top.productName} con ${formatMonto(_top.revenueWithTax)}.` : ''} Total: ${formatMonto(_totalRev)}. IMPORTANTE: estos son PRODUCTOS del catálogo, NO son clientes ni vendedores.`;

      return success({
        _descripcion,
        products,
        totalRevenueWithTax: _totalRev,
        totalRevenueWithoutTax: products.reduce((sum, p) => sum + p.revenueWithoutTax, 0),
        totalQuantity: products.reduce((sum, p) => sum + p.quantitySold, 0),
        period,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
