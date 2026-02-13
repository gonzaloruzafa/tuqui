/**
 * Skill: get_inactive_customers
 *
 * Detect churned customers - bought previously but stopped buying.
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange, getDefaultPeriod, getPreviousMonthPeriod } from './_client';
import { errorToResult } from '../errors';

export const GetInactiveCustomersInputSchema = z.object({
  currentPeriod: PeriodSchema.optional(),
  previousPeriod: PeriodSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  includeDetails: z.boolean().default(true),
});

export interface InactiveCustomer {
  customerId: number;
  customerName: string;
  previousPeriodAmount: number;
  previousPeriodOrders: number;
  lastOrderDate?: string;
  email?: string;
  phone?: string;
  city?: string;
}

export interface InactiveCustomersOutput {
  totalInactive: number;
  totalLostRevenue: number;
  customers: InactiveCustomer[];
  currentPeriod: { start: string; end: string; label?: string };
  previousPeriod: { start: string; end: string; label?: string };
}

export const getInactiveCustomers: Skill<
  typeof GetInactiveCustomersInputSchema,
  InactiveCustomersOutput
> = {
  name: 'get_inactive_customers',

  description: `Detecta clientes que dejaron de comprar (churn) - compraban antes pero no ahora.
USAR PARA: "clientes que dejaron de comprar", "churn", "clientes perdidos",
"clientes inactivos", "quién dejó de comprarnos", "clientes que no compran más".
Compara dos períodos: quién compraba en el anterior y no compró en el actual.
Incluye datos de contacto para reactivación.`,

  tool: 'odoo',
  tags: ['customers', 'churn', 'retention', 'crm', 'reporting'],
  inputSchema: GetInactiveCustomersInputSchema,

  async execute(input, context): Promise<SkillResult<InactiveCustomersOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const currentPeriod = input.currentPeriod || getDefaultPeriod();
      const previousPeriod = input.previousPeriod || getPreviousMonthPeriod();

      // Who bought in previous period?
      const prevBuyers = await odoo.readGroup(
        'sale.order',
        [
          ...dateRange('date_order', previousPeriod.start, previousPeriod.end),
          ['state', 'in', ['sale', 'done']],
        ],
        ['partner_id', 'amount_total:sum'],
        ['partner_id'],
        { limit: 500, orderBy: 'amount_total desc' }
      );

      if (prevBuyers.length === 0) {
        return success({
          totalInactive: 0,
          totalLostRevenue: 0,
          customers: [],
          currentPeriod,
          previousPeriod,
        });
      }

      // Who bought in current period?
      const currentBuyers = await odoo.readGroup(
        'sale.order',
        [
          ...dateRange('date_order', currentPeriod.start, currentPeriod.end),
          ['state', 'in', ['sale', 'done']],
        ],
        ['partner_id'],
        ['partner_id'],
        { limit: 500 }
      );

      const currentBuyerIds = new Set(
        currentBuyers
          .filter((g) => g.partner_id)
          .map((g) => (Array.isArray(g.partner_id) ? g.partner_id[0] : g.partner_id))
      );

      // Find who was in previous but not in current
      let inactive: InactiveCustomer[] = prevBuyers
        .filter((g) => {
          if (!g.partner_id) return false;
          const id = Array.isArray(g.partner_id) ? g.partner_id[0] : g.partner_id;
          return !currentBuyerIds.has(id);
        })
        .map((g) => ({
          customerId: Array.isArray(g.partner_id) ? g.partner_id[0] : g.partner_id,
          customerName: Array.isArray(g.partner_id) ? g.partner_id[1] : 'Sin nombre',
          previousPeriodAmount: g.amount_total || 0,
          previousPeriodOrders: g.partner_id_count || 0,
        }));

      // Sort by previous amount descending
      inactive.sort((a, b) => b.previousPeriodAmount - a.previousPeriodAmount);
      inactive = inactive.slice(0, input.limit);

      // Enrich with contact details + last order date
      if (input.includeDetails !== false && inactive.length > 0) {
        const inactiveIds = inactive.map((c) => c.customerId);

        const contacts = await odoo.searchRead<{
          id: number; email: string; phone: string; city: string;
        }>(
          'res.partner',
          [['id', 'in', inactiveIds]],
          { fields: ['id', 'email', 'phone', 'city'] }
        );

        const contactMap = new Map(contacts.map((c) => [c.id, c]));

        for (const customer of inactive) {
          const contact = contactMap.get(customer.customerId);
          if (contact) {
            customer.email = contact.email || undefined;
            customer.phone = contact.phone || undefined;
            customer.city = contact.city || undefined;
          }

          // Get last order date
          const lastOrders = await odoo.searchRead<{ date_order: string }>(
            'sale.order',
            [
              ['partner_id', '=', customer.customerId],
              ['state', 'in', ['sale', 'done']],
            ],
            { fields: ['date_order'], limit: 1, order: 'date_order desc' }
          );

          if (lastOrders.length > 0) {
            customer.lastOrderDate = lastOrders[0].date_order;
          }
        }
      }

      const totalLostRevenue = inactive.reduce((sum, c) => sum + c.previousPeriodAmount, 0);

      return success({
        totalInactive: inactive.length,
        totalLostRevenue,
        customers: inactive,
        currentPeriod,
        previousPeriod,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
