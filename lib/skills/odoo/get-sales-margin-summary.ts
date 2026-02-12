/**
 * Skill: get_sales_margin_summary
 *
 * Overall margin summary - aggregate view of profitability.
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod } from './_client';
import { errorToResult } from '../errors';

export const GetSalesMarginSummaryInputSchema = z.object({
  period: PeriodSchema.optional(),
  teamId: z.number().int().positive().optional(),
});

export interface SalesMarginSummaryOutput {
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  marginPercent: number;
  orderCount: number;
  productCount: number;
  period: { start: string; end: string; label?: string };
}

export const getSalesMarginSummary: Skill<
  typeof GetSalesMarginSummaryInputSchema,
  SalesMarginSummaryOutput
> = {
  name: 'get_sales_margin_summary',

  description: `Resumen general de margen de ventas - revenue vs costo, margen total.
USAR PARA: "cuánto margen tenemos", "rentabilidad general", "margen total",
"cuánto ganamos de verdad", "margen de ganancia general", "¿somos rentables?".
Vista agregada más simple que get_product_margin (no desglosa por producto).`,

  tool: 'odoo',
  tags: ['sales', 'margin', 'profitability', 'summary', 'reporting'],
  inputSchema: GetSalesMarginSummaryInputSchema,

  async execute(input, context): Promise<SkillResult<SalesMarginSummaryOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      const domain = combineDomains(
        dateRange('order_id.date_order', period.start, period.end),
        [['order_id.state', 'in', ['sale', 'done']]]
      );

      if (input.teamId) {
        domain.push(['order_id.team_id', '=', input.teamId]);
      }

      const totalAgg = await odoo.readGroup(
        'sale.order.line',
        domain,
        ['price_subtotal:sum', 'product_uom_qty:sum'],
        [],
        { limit: 1 }
      );

      if (totalAgg.length === 0 || !totalAgg[0].price_subtotal) {
        return success({
          totalRevenue: 0,
          totalCost: 0,
          totalMargin: 0,
          marginPercent: 0,
          orderCount: 0,
          productCount: 0,
          period,
        });
      }

      const totalRevenue = totalAgg[0].price_subtotal || 0;

      const productAgg = await odoo.readGroup(
        'sale.order.line',
        domain,
        ['product_id', 'price_subtotal:sum', 'product_uom_qty:sum'],
        ['product_id'],
        { limit: 500, orderBy: 'price_subtotal desc' }
      );

      const productIds = productAgg
        .filter((g) => g.product_id)
        .map((g) => (Array.isArray(g.product_id) ? g.product_id[0] : g.product_id));

      let totalCost = 0;

      if (productIds.length > 0) {
        const products = await odoo.searchRead<{ id: number; standard_price: number }>(
          'product.product',
          [['id', 'in', productIds]],
          { fields: ['id', 'standard_price'] }
        );

        const costMap = new Map(products.map((p) => [p.id, p.standard_price || 0]));

        for (const g of productAgg) {
          if (!g.product_id) continue;
          const pid = Array.isArray(g.product_id) ? g.product_id[0] : g.product_id;
          const qty = g.product_uom_qty || 0;
          const unitCost = costMap.get(pid) || 0;
          totalCost += unitCost * qty;
        }
      }

      const totalMargin = totalRevenue - totalCost;
      const marginPercent = totalRevenue > 0 ? Math.round((totalMargin / totalRevenue) * 100) : 0;

      const orderDomain = combineDomains(
        dateRange('date_order', period.start, period.end),
        [['state', 'in', ['sale', 'done']]]
      );
      if (input.teamId) orderDomain.push(['team_id', '=', input.teamId]);
      const orderCount = await odoo.searchCount('sale.order', orderDomain);

      return success({
        totalRevenue,
        totalCost,
        totalMargin,
        marginPercent,
        orderCount,
        productCount: productIds.length,
        period,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
