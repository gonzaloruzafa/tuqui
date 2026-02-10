/**
 * Skill: get_sales_by_category
 *
 * Ventas agrupadas por categoría de producto.
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError, PeriodSchema, DocumentStateSchema } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

export const GetSalesByCategoryInputSchema = z.object({
  /** Time period for analysis */
  period: PeriodSchema.optional(),
  /** Filter by order state */
  state: DocumentStateSchema.default('confirmed'),
  /** Maximum categories to return */
  limit: z.number().int().min(1).max(50).default(20),
  /** Filter by sales team ID */
  teamId: z.number().int().positive().optional(),
});

export type GetSalesByCategoryInput = z.infer<typeof GetSalesByCategoryInputSchema>;

export interface CategorySales {
  categoryId: number;
  categoryName: string;
  /** Total with taxes */
  totalWithTax: number;
  /** Total without taxes */
  totalWithoutTax: number;
  quantitySold: number;
  orderCount: number;
  /** Percentage of grand total (with tax) */
  percentage: number;
}

export interface SalesByCategoryOutput {
  categories: CategorySales[];
  grandTotalWithTax: number;
  grandTotalWithoutTax: number;
  totalQuantity: number;
  categoryCount: number;
  period: z.infer<typeof PeriodSchema>;
}

export const getSalesByCategory: Skill<
  typeof GetSalesByCategoryInputSchema,
  SalesByCategoryOutput
> = {
  name: 'get_sales_by_category',
  description: `Ventas agrupadas por categoría/rubro/línea de producto.
USAR CUANDO: "ventas por categoría", "ventas por rubro", "mix de productos", "distribución por línea",
"cuánto vendimos de equipamiento vs descartables", "qué categoría vende más", "qué rubro creció".
NO USAR: para detalle por producto individual (usar get_sales_by_product), para ranking de productos (usar get_top_products).
USA MES ACTUAL si no se indica período. EJECUTAR SIN PREGUNTAR período.
RETORNA: lista con categoryName, totalAmount, quantitySold, percentage del total.`,
  tool: 'odoo',
  tags: ['sales', 'products', 'categories', 'reporting'],
  inputSchema: GetSalesByCategoryInputSchema,

  async execute(input, context): Promise<SkillResult<SalesByCategoryOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      const baseDomain = dateRange('order_id.date_order', period.start, period.end);

      let domain: OdooDomain;
      if (input.state === 'all') {
        domain = [...baseDomain];
      } else if (input.state === 'confirmed') {
        domain = combineDomains(baseDomain, [['order_id.state', 'in', ['sale', 'done']]]);
      } else {
        const stateValue = input.state === 'draft' ? 'draft' : 'cancel';
        domain = combineDomains(baseDomain, [['order_id.state', '=', stateValue]]);
      }

      if (input.teamId) {
        domain.push(['order_id.team_id', '=', input.teamId]);
      }

      const grouped = await odoo.readGroup(
        'sale.order.line',
        domain,
        ['product_id.categ_id', 'product_uom_qty:sum', 'price_total:sum', 'price_subtotal:sum', 'order_id:count_distinct'],
        ['product_id.categ_id'],
        { limit: input.limit, orderBy: 'price_total desc' }
      );

      // Calculate grand total first for percentages
      const grandTotalWithTax = grouped.reduce((sum, g) => sum + (g.price_total || 0), 0);
      const grandTotalWithoutTax = grouped.reduce((sum, g) => sum + (g.price_subtotal || 0), 0);

      const categories: CategorySales[] = grouped
        .filter((g) => g['product_id.categ_id'] && Array.isArray(g['product_id.categ_id']))
        .map((g) => {
          const [categoryId, categoryName] = g['product_id.categ_id'] as [number, string];
          const totalWithTax = g.price_total || 0;
          const totalWithoutTax = g.price_subtotal || 0;
          const quantitySold = g.product_uom_qty || 0;
          const orderCount = (g as any).order_id_count || (g as any).order_id || 1;

          return {
            categoryId,
            categoryName,
            totalWithTax,
            totalWithoutTax,
            quantitySold,
            orderCount,
            percentage: grandTotalWithTax > 0 ? Math.round((totalWithTax / grandTotalWithTax) * 10000) / 100 : 0,
          };
        });

      return success({
        categories,
        grandTotalWithTax,
        grandTotalWithoutTax,
        totalQuantity: categories.reduce((sum, c) => sum + c.quantitySold, 0),
        categoryCount: categories.length,
        period,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
