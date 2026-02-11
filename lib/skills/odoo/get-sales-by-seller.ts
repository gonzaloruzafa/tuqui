/**
 * Skill: get_sales_by_seller
 *
 * Get sales grouped by salesperson.
 *
 * Use cases:
 * - "¿Quién vendió más este mes?"
 * - "Ventas por vendedor"
 * - "Comisiones del mes"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError, PeriodSchema, DocumentStateSchema } from '../types';
import { createOdooClient, dateRange, stateFilter, combineDomains, getDefaultPeriod } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetSalesBySellerInputSchema = z.object({
  /** Time period for analysis */
  period: PeriodSchema.optional(),

  /** Maximum number of sellers to return */
  limit: z.number().int().min(1).max(100).default(10),

  /** Filter by order state */
  state: DocumentStateSchema.default('confirmed'),

  /** Filter by sales team ID (e.g., ecommerce, tienda web) */
  teamId: z.number().int().positive().optional(),
});

// ============================================
// OUTPUT TYPE
// ============================================

export interface SellerSales {
  sellerId: number;
  sellerName: string;
  orderCount: number;
  /** Total sales with taxes */
  totalWithTax: number;
  /** Total sales without taxes */
  totalWithoutTax: number;
  avgOrderValue: number;
}

export interface SalesBySellerOutput {
  sellers: SellerSales[];
  grandTotalWithTax: number;
  grandTotalWithoutTax: number;
  totalOrders: number;
  sellerCount: number;
  period: z.infer<typeof PeriodSchema>;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getSalesBySeller: Skill<
  typeof GetSalesBySellerInputSchema,
  SalesBySellerOutput
> = {
  name: 'get_sales_by_seller',
  description: `Ventas agrupadas por vendedor - quién vendió cuánto.
USAR PARA: "ventas por vendedor", "quién vendió más", "comisiones", "ranking vendedores".
Soporta filtro por equipo (teamId). SIEMPRE llamar get_sales_teams primero para obtener el ID.`,
  tool: 'odoo',
  tags: ['sales', 'sellers', 'commissions', 'reporting'],
  inputSchema: GetSalesBySellerInputSchema,

  async execute(input, context): Promise<SkillResult<SalesBySellerOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      // Build domain
      const domain = combineDomains(
        dateRange('date_order', period.start, period.end),
        stateFilter(input.state, 'sale.order')
      );

      // Filter by sales team if specified
      if (input.teamId) {
        domain.push(['team_id', '=', input.teamId]);
      }

      // Group by user (salesperson)
      const grouped = await odoo.readGroup(
        'sale.order',
        domain,
        ['user_id', 'amount_total:sum', 'amount_untaxed:sum'],
        ['user_id'],
        {
          limit: input.limit,
          orderBy: 'amount_total desc',
        }
      );

      // Transform results
      const sellers: SellerSales[] = grouped
        .filter((g) => g.user_id && Array.isArray(g.user_id))
        .map((g) => {
          const [sellerId, sellerName] = g.user_id as [number, string];
          const totalWithTax = g.amount_total || 0;
          const totalWithoutTax = g.amount_untaxed || 0;
          const orderCount = g.user_id_count || 1;

          return {
            sellerId,
            sellerName,
            orderCount,
            totalWithTax,
            totalWithoutTax,
            avgOrderValue: totalWithTax / orderCount,
          };
        });

      // Calculate totals
      const grandTotalWithTax = sellers.reduce((sum, s) => sum + s.totalWithTax, 0);
      const grandTotalWithoutTax = sellers.reduce((sum, s) => sum + s.totalWithoutTax, 0);
      const totalOrders = sellers.reduce((sum, s) => sum + s.orderCount, 0);

      return success({
        sellers,
        grandTotalWithTax,
        grandTotalWithoutTax,
        totalOrders,
        sellerCount: sellers.length,
        period,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
