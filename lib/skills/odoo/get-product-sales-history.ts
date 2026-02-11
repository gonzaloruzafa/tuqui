/**
 * Skill: get_product_sales_history
 *
 * Get sales history for a specific product.
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod } from './_client';
import { errorToResult } from '../errors';

export const GetProductSalesHistoryInputSchema = z.object({
  /** Product variant ID (product.product). Use for a specific variant. */
  productId: z.number().int().positive().optional(),
  /** Product template ID (product.template). Use to aggregate ALL variants of a product. */
  productTemplateId: z.number().int().positive().optional(),
  period: PeriodSchema.optional(),
  groupBy: z.enum(['none', 'month', 'customer']).default('none'),
  /** Sales team ID. Obtener de get_sales_teams, NO adivinar. */
  teamId: z.number().int().positive().optional(),
});

export interface ProductSalesHistoryOutput {
  productId: number;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  period: z.infer<typeof PeriodSchema>;
  groups?: Record<string, { quantity: number; revenue: number }>;
}

export const getProductSalesHistory: Skill<
  typeof GetProductSalesHistoryInputSchema,
  ProductSalesHistoryOutput
> = {
  name: 'get_product_sales_history',
  description: `Historial de ventas de un producto específico.
USAR CUANDO: "cuánto vendimos de X", "ventas del producto", "historial de ventas".
IMPORTANTE: El período default es el mes actual. Para evaluar si un producto
tiene movimiento o rotación, usá un período de al menos 6 meses.
Para comparar períodos (ej: enero vs febrero, este año vs el anterior),
llamá este skill dos veces con períodos distintos.
Para productos con VARIANTES: usar productTemplateId (obtenido de search_products.templateId)
para agregar ventas de TODAS las variantes. Si usás productId, solo verás UNA variante.
Soporta groupBy: 'month' para evolución mensual, 'customer' para compradores.
Soporta filtro por equipo (teamId). SIEMPRE llamar get_sales_teams primero para obtener el ID.`,
  tool: 'odoo',
  tags: ['sales', 'products', 'history'],
  inputSchema: GetProductSalesHistoryInputSchema,

  async execute(input, context): Promise<SkillResult<ProductSalesHistoryOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      // Resolve product filter: template → all variant IDs, or single product ID
      let productFilter: ['product_id', '=' | 'in', number | number[]];
      if (input.productTemplateId) {
        const variants = await odoo.searchRead<{ id: number }>(
          'product.product',
          [['product_tmpl_id', '=', input.productTemplateId]],
          { fields: ['id'] }
        );
        const variantIds = variants.map(v => v.id);
        if (variantIds.length === 0) {
          return success({ productId: 0, totalQuantity: 0, totalRevenue: 0, orderCount: 0, period });
        }
        productFilter = ['product_id', 'in', variantIds];
      } else if (input.productId) {
        productFilter = ['product_id', '=', input.productId];
      } else {
        return success({ productId: 0, totalQuantity: 0, totalRevenue: 0, orderCount: 0, period });
      }

      // sale.order.line doesn't have date_order or state directly
      // Must use order_id.date_order and order_id.state
      const domain = combineDomains(
        dateRange('order_id.date_order', period.start, period.end),
        [
          productFilter,
          ['order_id.state', 'in', ['sale', 'done']],
        ]
      );

      // Filter by sales team if specified
      if (input.teamId) {
        domain.push(['order_id.team_id', '=', input.teamId]);
      }

      if (input.groupBy === 'none') {
        const lines = await odoo.searchRead<{
          product_uom_qty: number;
          price_total: number;
        }>(
          'sale.order.line',
          domain,
          { fields: ['product_uom_qty', 'price_total'] }
        );

        const totalQuantity = lines.reduce((sum, l) => sum + l.product_uom_qty, 0);
        const totalRevenue = lines.reduce((sum, l) => sum + l.price_total, 0);

        return success({
          productId: input.productId || input.productTemplateId || 0,
          totalQuantity,
          totalRevenue,
          orderCount: lines.length,
          period,
        });
      }

      // Grouped version - use order_id.date_order for the parent order's date
      const groupField = input.groupBy === 'month' ? 'order_id.date_order:month' : 'order_id.partner_id';
      const grouped = await odoo.readGroup(
        'sale.order.line',
        domain,
        [groupField, 'product_uom_qty:sum', 'price_total:sum'],
        [groupField],
        {}
      );

      const groups: Record<string, { quantity: number; revenue: number }> = {};
      let totalQuantity = 0;
      let totalRevenue = 0;

      for (const g of grouped) {
        // The grouped result key uses the field name with dots replaced
        // order_id.date_order becomes order_id (the first part after group)
        const key = input.groupBy === 'month'
          ? (g['order_id.date_order'] || g['order_id'] || 'Unknown')
          : (g['order_id.partner_id'] && Array.isArray(g['order_id.partner_id']) 
              ? g['order_id.partner_id'][1] 
              : (g.order_id?.partner_id?.[1] || 'Unknown'));

        groups[key] = {
          quantity: g.product_uom_qty || 0,
          revenue: g.price_total || 0,
        };
        totalQuantity += g.product_uom_qty || 0;
        totalRevenue += g.price_total || 0;
      }

      return success({
        productId: input.productId || input.productTemplateId || 0,
        totalQuantity,
        totalRevenue,
        orderCount: grouped.length,
        period,
        groups,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
