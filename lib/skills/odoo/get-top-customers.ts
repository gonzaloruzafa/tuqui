/**
 * Skill: get_top_customers
 *
 * Get top customers by sales revenue.
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod } from './_client';
import { errorToResult } from '../errors';

export const GetTopCustomersInputSchema = z.object({
  period: PeriodSchema.optional(),
  limit: z.number().int().min(1).max(100).default(10),
  minAmount: z.number().min(0).optional(),
  /** Filter by sales team ID (e.g., ecommerce, tienda web) */
  teamId: z.number().int().positive().optional(),
});

export interface TopCustomer {
  customerId: number;
  customerName: string;
  orderCount: number;
  /** Total revenue with taxes */
  totalRevenueWithTax: number;
  /** Total revenue without taxes */
  totalRevenueWithoutTax: number;
  avgOrderValue: number;
}

export interface TopCustomersOutput {
  customers: TopCustomer[];
  totalRevenueWithTax: number;
  totalRevenueWithoutTax: number;
  period: z.infer<typeof PeriodSchema>;
}

export const getTopCustomers: Skill<
  typeof GetTopCustomersInputSchema,
  TopCustomersOutput
> = {
  name: 'get_top_customers',
  description: `Top clientes por ventas - mejores clientes y cuánto compraron. USA MES ACTUAL si no hay período.
Use for: "mejores clientes", "clientes top", "best customers", "quién compra más", "mi mejor cliente".
SIEMPRE ejecutar sin preguntar período - usa default mes actual automáticamente.`,
  tool: 'odoo',
  tags: ['sales', 'customers', 'reporting'],
  inputSchema: GetTopCustomersInputSchema,

  async execute(input, context): Promise<SkillResult<TopCustomersOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      const domain = combineDomains(
        dateRange('date_order', period.start, period.end),
        [['state', 'in', ['sale', 'done']]]
      );

      // Filter by sales team if specified
      if (input.teamId) {
        domain.push(['team_id', '=', input.teamId]);
      }

      const grouped = await odoo.readGroup(
        'sale.order',
        domain,
        ['partner_id', 'amount_total:sum', 'amount_untaxed:sum'],
        ['partner_id'],
        { limit: input.limit * 2, orderBy: 'amount_total desc' }
      );

      let customers: TopCustomer[] = grouped
        .filter((g) => g.partner_id && Array.isArray(g.partner_id))
        .map((g) => {
          const totalRevenueWithTax = g.amount_total || 0;
          const totalRevenueWithoutTax = g.amount_untaxed || 0;
          const orderCount = g.partner_id_count || 1;
          return {
            customerId: (g.partner_id as [number, string])[0],
            customerName: (g.partner_id as [number, string])[1],
            orderCount,
            totalRevenueWithTax,
            totalRevenueWithoutTax,
            avgOrderValue: totalRevenueWithTax / orderCount,
          };
        });

      if (input.minAmount) {
        customers = customers.filter((c) => c.totalRevenueWithTax >= input.minAmount!);
      }

      customers = customers.slice(0, input.limit);

      return success({
        customers,
        totalRevenueWithTax: customers.reduce((sum, c) => sum + c.totalRevenueWithTax, 0),
        totalRevenueWithoutTax: customers.reduce((sum, c) => sum + c.totalRevenueWithoutTax, 0),
        period,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
