/**
 * Skill: get_product_margin
 *
 * Margin analysis per product - revenue vs cost, sorted by most profitable.
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod } from './_client';
import { errorToResult } from '../errors';

export const GetProductMarginInputSchema = z.object({
  period: PeriodSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['margin_total', 'margin_percent', 'revenue']).default('margin_total'),
  maxMarginPercent: z.number().optional(),
  minRevenue: z.number().min(0).optional(),
  teamId: z.number().int().positive().optional(),
});

export interface ProductMarginItem {
  productId: number;
  productName: string;
  revenue: number;
  cost: number;
  marginTotal: number;
  marginPercent: number;
  quantitySold: number;
}

export interface ProductMarginOutput {
  products: ProductMarginItem[];
  totals: {
    revenue: number;
    cost: number;
    marginTotal: number;
    marginPercent: number;
  };
  period: { start: string; end: string; label?: string };
}

export const getProductMargin: Skill<
  typeof GetProductMarginInputSchema,
  ProductMarginOutput
> = {
  name: 'get_product_margin',

  description: `Análisis de margen por producto - cuánto ganamos por cada producto vendido.
USAR PARA: "margen por producto", "qué productos dan más ganancia", "cuánto margen tiene X",
"productos menos rentables", "margen de ganancia", "rentabilidad por producto".
Combina sale.order.line (revenue) con standard_price del product.product (costo).
Permite ordenar por margen total, porcentaje o revenue.
Filtra por maxMarginPercent para encontrar productos con bajo margen.`,

  tool: 'odoo',
  tags: ['sales', 'margin', 'products', 'profitability', 'reporting'],
  inputSchema: GetProductMarginInputSchema,

  async execute(input, context): Promise<SkillResult<ProductMarginOutput>> {
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

      const grouped = await odoo.readGroup(
        'sale.order.line',
        domain,
        ['product_id', 'price_subtotal:sum', 'product_uom_qty:sum'],
        ['product_id'],
        { limit: 200, orderBy: 'price_subtotal desc' }
      );

      if (grouped.length === 0) {
        return success({
          products: [],
          totals: { revenue: 0, cost: 0, marginTotal: 0, marginPercent: 0 },
          period,
        });
      }

      const productIds = grouped
        .filter((g) => g.product_id)
        .map((g) => (Array.isArray(g.product_id) ? g.product_id[0] : g.product_id));

      const productCosts = await odoo.searchRead<{ id: number; standard_price: number }>(
        'product.product',
        [['id', 'in', productIds]],
        { fields: ['id', 'standard_price'] }
      );

      const costMap = new Map(productCosts.map((p) => [p.id, p.standard_price || 0]));

      let products: ProductMarginItem[] = grouped
        .filter((g) => g.product_id)
        .map((g) => {
          const productId = Array.isArray(g.product_id) ? g.product_id[0] : g.product_id;
          const productName = Array.isArray(g.product_id) ? g.product_id[1] : 'Sin nombre';
          const revenue = g.price_subtotal || 0;
          const qty = g.product_uom_qty || 0;
          const unitCost = costMap.get(productId) || 0;
          const cost = unitCost * qty;
          const marginTotal = revenue - cost;
          const marginPercent = revenue > 0 ? Math.round((marginTotal / revenue) * 100) : 0;

          return { productId, productName, revenue, cost, marginTotal, marginPercent, quantitySold: qty };
        });

      if (input.maxMarginPercent !== undefined) {
        products = products.filter((p) => p.marginPercent <= input.maxMarginPercent!);
      }
      if (input.minRevenue !== undefined) {
        products = products.filter((p) => p.revenue >= input.minRevenue!);
      }

      const sortFn = {
        margin_total: (a: ProductMarginItem, b: ProductMarginItem) => b.marginTotal - a.marginTotal,
        margin_percent: (a: ProductMarginItem, b: ProductMarginItem) => b.marginPercent - a.marginPercent,
        revenue: (a: ProductMarginItem, b: ProductMarginItem) => b.revenue - a.revenue,
      };
      products.sort(sortFn[input.sortBy]);
      products = products.slice(0, input.limit);

      const totals = products.reduce(
        (acc, p) => ({
          revenue: acc.revenue + p.revenue,
          cost: acc.cost + p.cost,
          marginTotal: acc.marginTotal + p.marginTotal,
          marginPercent: 0,
        }),
        { revenue: 0, cost: 0, marginTotal: 0, marginPercent: 0 }
      );
      totals.marginPercent = totals.revenue > 0 ? Math.round((totals.marginTotal / totals.revenue) * 100) : 0;

      return success({ products, totals, period });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
