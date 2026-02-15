/**
 * Skill: get_subscription_churn
 *
 * Analyzes subscription cancellations vs new subscriptions in a period.
 * Computes churn rate, net growth, and optionally compares with previous period.
 * Answers: "How much churn did we have?" "Are we growing or shrinking?"
 *
 * Odoo 17+: subscriptions live in sale.order with is_subscription=True
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange, getDefaultPeriod, formatMonto } from './_client';
import { errorToResult } from '../errors';

export const GetSubscriptionChurnInputSchema = z.object({
  /** Period to analyze */
  period: PeriodSchema.optional(),
  /** Compare with immediately preceding period of same length */
  compareWithPrevious: z.boolean().default(true),
  /** Max churned customers to list */
  limit: z.number().int().min(1).max(30).default(10),
});

export interface ChurnedCustomer {
  partnerId: number;
  partnerName: string;
  lostMRR: number;
  endDate: string;
  subscriptionName: string;
}

export interface ChurnPeriodData {
  churnedCount: number;
  churnedMRR: number;
  newCount: number;
  newMRR: number;
  netGrowth: number;
  netGrowthMRR: number;
}

export interface SubscriptionChurnOutput {
  current: ChurnPeriodData;
  churnRate: number;
  totalActiveAtEnd: number;
  previous?: ChurnPeriodData;
  trend: 'mejorando' | 'empeorando' | 'estable';
  topChurnedCustomers: ChurnedCustomer[];
  period: { start: string; end: string; label?: string };
}

export const getSubscriptionChurn: Skill<
  typeof GetSubscriptionChurnInputSchema,
  SubscriptionChurnOutput
> = {
  name: 'get_subscription_churn',

  description: `Analiza cancelaciones de suscripciones vs nuevas — churn rate y crecimiento neto.
USAR PARA: "churn de suscripciones", "cuántos cancelaron", "cuánto MRR perdimos",
"quién canceló", "crecimiento neto", "estamos creciendo o achicándonos",
"suscripciones perdidas", "bajas de suscripciones", "tendencia de suscripciones".
Compara con período anterior para ver si el churn mejora o empeora.
Lista los clientes que más MRR perdimos para acción de retención.`,

  tool: 'odoo',
  tags: ['subscriptions', 'churn', 'growth', 'retention', 'analysis'],
  inputSchema: GetSubscriptionChurnInputSchema,

  async execute(input, context): Promise<SkillResult<SubscriptionChurnOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      const fetchPeriodData = async (start: string, end: string): Promise<ChurnPeriodData> => {
        // Churned: subscription_state in [churn, closed] with write_date in period
        const churnedAgg = await odoo.readGroup(
          'sale.order',
          [
            ['is_subscription', '=', true],
            ['subscription_state', 'in', ['churn', 'closed']],
            ...dateRange('write_date', start, end),
          ],
          ['recurring_monthly:sum'],
          [],
          { limit: 1 }
        );

        const churnedCount = churnedAgg.length > 0 ? (churnedAgg[0].__count || 0) : 0;
        const churnedMRR = churnedAgg.length > 0 ? (churnedAgg[0].recurring_monthly || 0) : 0;

        // New: start_date in period and currently active
        const newAgg = await odoo.readGroup(
          'sale.order',
          [
            ['is_subscription', '=', true],
            ['subscription_state', '=', 'in_progress'],
            ...dateRange('start_date', start, end),
          ],
          ['recurring_monthly:sum'],
          [],
          { limit: 1 }
        );

        const newCount = newAgg.length > 0 ? (newAgg[0].__count || 0) : 0;
        const newMRR = newAgg.length > 0 ? (newAgg[0].recurring_monthly || 0) : 0;

        return {
          churnedCount,
          churnedMRR,
          newCount,
          newMRR,
          netGrowth: newCount - churnedCount,
          netGrowthMRR: newMRR - churnedMRR,
        };
      };

      // Current period
      const current = await fetchPeriodData(period.start, period.end);

      // Total active at end of period (for churn rate calculation)
      const activeCount = await odoo.searchCount('sale.order', [
        ['is_subscription', '=', true],
        ['subscription_state', '=', 'in_progress'],
      ]);

      const churnRate = activeCount + current.churnedCount > 0
        ? Math.round((current.churnedCount / (activeCount + current.churnedCount)) * 100)
        : 0;

      // Previous period (same length)
      let previous: ChurnPeriodData | undefined;
      let trend: 'mejorando' | 'empeorando' | 'estable' = 'estable';

      if (input.compareWithPrevious) {
        const startDate = new Date(period.start);
        const endDate = new Date(period.end);
        const periodLengthMs = endDate.getTime() - startDate.getTime();
        const prevEnd = new Date(startDate.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - periodLengthMs);

        previous = await fetchPeriodData(
          prevStart.toISOString().split('T')[0],
          prevEnd.toISOString().split('T')[0]
        );

        if (current.churnedCount < previous.churnedCount) trend = 'mejorando';
        else if (current.churnedCount > previous.churnedCount) trend = 'empeorando';
      }

      // Top churned customers
      const churnedRecords = await odoo.searchRead<{
        id: number;
        name: string;
        partner_id: [number, string] | false;
        recurring_monthly: number;
        end_date: string;
      }>(
        'sale.order',
        [
          ['is_subscription', '=', true],
          ['subscription_state', 'in', ['churn', 'closed']],
          ...dateRange('write_date', period.start, period.end),
        ],
        {
          fields: ['name', 'partner_id', 'recurring_monthly', 'end_date'],
          limit: input.limit,
          order: 'recurring_monthly desc',
        }
      );

      const topChurnedCustomers: ChurnedCustomer[] = churnedRecords.map((r) => ({
        partnerId: Array.isArray(r.partner_id) ? r.partner_id[0] : 0,
        partnerName: Array.isArray(r.partner_id) ? r.partner_id[1] : 'Sin nombre',
        lostMRR: r.recurring_monthly || 0,
        endDate: r.end_date || '',
        subscriptionName: r.name,
      }));

      const _descripcion = `SUSCRIPCIONES (churn) del ${period.start} al ${period.end}: ${current.churnedCount} canceladas (MRR perdido ${formatMonto(current.churnedMRR)}), ${current.newCount} nuevas (MRR ganado ${formatMonto(current.newMRR)}), crecimiento neto ${current.netGrowth} suscripciones. Churn rate: ${churnRate}%. ${activeCount} activas al cierre. Tendencia: ${trend}. Top ${topChurnedCustomers.length} clientes que churnearon listados. IMPORTANTE: los clientes que churnearon son CLIENTES suscriptores, NO son vendedores.`;

      return success({
        _descripcion,
        current,
        churnRate,
        totalActiveAtEnd: activeCount,
        previous,
        trend,
        topChurnedCustomers,
        period,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
