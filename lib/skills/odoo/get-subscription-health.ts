/**
 * Skill: get_subscription_health
 *
 * Snapshot of the recurring business: MRR, subscription distribution by state,
 * at-risk subscriptions (paused + expiring soon), top customers by MRR.
 * Answers: "How are our subscriptions doing?" "What's the MRR?"
 *
 * Odoo 17+: subscriptions live in sale.order with is_subscription=True
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient } from './_client';
import { errorToResult } from '../errors';

export const GetSubscriptionHealthInputSchema = z.object({
  /** Filter by sales team */
  teamId: z.number().int().positive().optional(),
  /** Filter by salesperson */
  userId: z.number().int().positive().optional(),
  /** How many days ahead to check for expiring subscriptions (default 30) */
  expiringWithinDays: z.number().int().min(1).max(180).default(30),
  /** Max top customers to show */
  limit: z.number().int().min(1).max(30).default(10),
});

export interface SubscriptionStateBreakdown {
  state: string;
  stateLabel: string;
  count: number;
  mrr: number;
}

export interface AtRiskSummary {
  pausedCount: number;
  pausedMRR: number;
  expiringCount: number;
  expiringMRR: number;
  totalAtRiskCount: number;
  totalAtRiskMRR: number;
}

export interface TopSubscriptionCustomer {
  partnerId: number;
  partnerName: string;
  mrr: number;
  subscriptionCount: number;
  state: string;
}

export interface SubscriptionHealthOutput {
  totalMRR: number;
  totalActiveSubscriptions: number;
  totalAllSubscriptions: number;
  stateBreakdown: SubscriptionStateBreakdown[];
  atRisk: AtRiskSummary;
  topCustomersByMRR: TopSubscriptionCustomer[];
}

const STATE_LABELS: Record<string, string> = {
  draft: 'Borrador',
  in_progress: 'Activa',
  paused: 'Pausada',
  closed: 'Cerrada',
  churn: 'Cancelada',
};

export const getSubscriptionHealth: Skill<
  typeof GetSubscriptionHealthInputSchema,
  SubscriptionHealthOutput
> = {
  name: 'get_subscription_health',

  description: `Foto actual del negocio recurrente — MRR, suscripciones por estado, clientes en riesgo.
USAR PARA: "cómo están las suscripciones", "MRR", "ingreso recurrente mensual",
"cuántas suscripciones activas", "suscripciones en riesgo", "quién está por vencer",
"salud del negocio recurrente", "cuánto facturamos recurrente", "suscripciones pausadas".
Detecta riesgo: suscripciones pausadas + las que vencen en los próximos 30 días.
Top clientes por MRR para saber dónde está concentrado el ingreso.`,

  tool: 'odoo',
  tags: ['subscriptions', 'mrr', 'recurring', 'health', 'analysis'],
  inputSchema: GetSubscriptionHealthInputSchema,

  async execute(input, context): Promise<SkillResult<SubscriptionHealthOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      // Base domain: all subscriptions
      const baseDomain: any[] = [['is_subscription', '=', true]];
      if (input.teamId) baseDomain.push(['team_id', '=', input.teamId]);
      if (input.userId) baseDomain.push(['user_id', '=', input.userId]);

      // 1. Breakdown by subscription_state
      const grouped = await odoo.readGroup(
        'sale.order',
        baseDomain,
        ['subscription_state', 'recurring_monthly:sum'],
        ['subscription_state'],
        { limit: 10 }
      );

      let totalMRR = 0;
      let totalActiveSubscriptions = 0;
      let totalAllSubscriptions = 0;

      const stateBreakdown: SubscriptionStateBreakdown[] = grouped
        .filter((g) => g.subscription_state)
        .map((g) => {
          const count = g.subscription_state_count || g.__count || 0;
          const mrr = g.recurring_monthly || 0;
          totalAllSubscriptions += count;
          if (g.subscription_state === 'in_progress') {
            totalActiveSubscriptions += count;
            totalMRR += mrr;
          }
          return {
            state: g.subscription_state,
            stateLabel: STATE_LABELS[g.subscription_state] || g.subscription_state,
            count,
            mrr,
          };
        });

      // 2. At-risk: paused subscriptions
      const pausedData = stateBreakdown.find((s) => s.state === 'paused');
      const pausedCount = pausedData?.count || 0;
      const pausedMRR = pausedData?.mrr || 0;

      // 3. At-risk: expiring soon (end_date within threshold)
      const expiringCutoff = new Date();
      expiringCutoff.setDate(expiringCutoff.getDate() + input.expiringWithinDays);
      const expiringCutoffStr = expiringCutoff.toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];

      const expiringDomain: any[] = [
        ...baseDomain,
        ['subscription_state', '=', 'in_progress'],
        ['end_date', '!=', false],
        ['end_date', '>=', todayStr],
        ['end_date', '<=', expiringCutoffStr],
      ];

      const expiringAgg = await odoo.readGroup(
        'sale.order',
        expiringDomain,
        ['recurring_monthly:sum'],
        [],
        { limit: 1 }
      );

      const expiringCount = expiringAgg.length > 0 ? (expiringAgg[0].__count || 0) : 0;
      const expiringMRR = expiringAgg.length > 0 ? (expiringAgg[0].recurring_monthly || 0) : 0;

      const atRisk: AtRiskSummary = {
        pausedCount,
        pausedMRR,
        expiringCount,
        expiringMRR,
        totalAtRiskCount: pausedCount + expiringCount,
        totalAtRiskMRR: pausedMRR + expiringMRR,
      };

      // 4. Top customers by MRR (active subs only)
      const topCustomers = await odoo.readGroup(
        'sale.order',
        [...baseDomain, ['subscription_state', '=', 'in_progress']],
        ['partner_id', 'recurring_monthly:sum'],
        ['partner_id'],
        { limit: input.limit, orderBy: 'recurring_monthly desc' }
      );

      const topCustomersByMRR: TopSubscriptionCustomer[] = topCustomers
        .filter((g) => g.partner_id)
        .map((g) => ({
          partnerId: Array.isArray(g.partner_id) ? g.partner_id[0] : g.partner_id,
          partnerName: Array.isArray(g.partner_id) ? g.partner_id[1] : 'Sin nombre',
          mrr: g.recurring_monthly || 0,
          subscriptionCount: g.partner_id_count || g.__count || 0,
          state: 'in_progress',
        }));

      return success({
        totalMRR,
        totalActiveSubscriptions,
        totalAllSubscriptions,
        stateBreakdown,
        atRisk,
        topCustomersByMRR,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
