/**
 * Skill: get_stale_opportunities
 *
 * Detects opportunities stuck in the same pipeline stage for too long.
 * Answers: "How much money is stuck in the pipeline without movement?"
 * "Where do deals get stuck?"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient } from './_client';
import { errorToResult } from '../errors';

export const GetStaleOpportunitiesInputSchema = z.object({
  /** Days without stage change to consider stale (default: 30) */
  staleDays: z.number().int().min(1).max(365).default(30),
  /** Filter by specific stage ID */
  stageId: z.number().int().positive().optional(),
  /** Filter by salesperson user ID */
  userId: z.number().int().positive().optional(),
  /** Max individual opportunities to return */
  limit: z.number().int().min(1).max(50).default(15),
});

export interface StaleStageBreakdown {
  stageId: number;
  stageName: string;
  count: number;
  totalRevenue: number;
  avgDaysStuck: number;
}

export interface StaleOpportunity {
  id: number;
  name: string;
  partner: string;
  stage: string;
  daysSinceUpdate: number;
  expectedRevenue: number;
  user: string;
}

export interface StaleOpportunitiesOutput {
  totalStaleCount: number;
  totalStaleRevenue: number;
  avgDaysStuck: number;
  stageBreakdown: StaleStageBreakdown[];
  topStaleOpportunities: StaleOpportunity[];
  staleDaysThreshold: number;
}

export const getStaleOpportunities: Skill<
  typeof GetStaleOpportunitiesInputSchema,
  StaleOpportunitiesOutput
> = {
  name: 'get_stale_opportunities',

  description: `Detecta oportunidades estancadas en el pipeline - sin movimiento de etapa.
USAR PARA: "oportunidades estancadas", "pipeline parado", "oportunidades sin movimiento",
"cuánta guita tengo trabada", "hace cuánto no se mueven", "dónde se traban las oportunidades",
"qué oportunidades están paradas", "deals estancados".
Muestra en qué etapa se traban más y cuánta plata hay parada.
Incluye detalle de las oportunidades más grandes estancadas.`,

  tool: 'odoo',
  tags: ['crm', 'pipeline', 'stale', 'analysis', 'opportunities'],
  inputSchema: GetStaleOpportunitiesInputSchema,

  async execute(input, context): Promise<SkillResult<StaleOpportunitiesOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.staleDays);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];

      // Build domain: open opportunities with last stage change before cutoff
      const domain: any[] = [
        ['type', '=', 'opportunity'],
        ['active', '=', true],
        ['probability', '<', 100],
        ['date_last_stage_update', '<=', cutoffStr],
      ];

      if (input.stageId) {
        domain.push(['stage_id', '=', input.stageId]);
      }
      if (input.userId) {
        domain.push(['user_id', '=', input.userId]);
      }

      // Stage breakdown via readGroup
      const grouped = await odoo.readGroup(
        'crm.lead',
        domain,
        ['stage_id', 'expected_revenue:sum', 'date_last_stage_update:min'],
        ['stage_id'],
        { limit: 20, orderBy: 'expected_revenue desc' }
      );

      const now = Date.now();
      let totalStaleCount = 0;
      let totalStaleRevenue = 0;
      let totalWeightedDays = 0;

      const stageBreakdown: StaleStageBreakdown[] = grouped
        .filter((g) => g.stage_id)
        .map((g) => {
          const count = g.stage_id_count || g.__count || 0;
          const revenue = g.expected_revenue || 0;
          // Approximate avg days from the min date (conservative estimate)
          const minDate = g.date_last_stage_update
            ? new Date(g.date_last_stage_update).getTime()
            : cutoffDate.getTime();
          const avgDays = Math.round((now - minDate) / (1000 * 60 * 60 * 24));

          totalStaleCount += count;
          totalStaleRevenue += revenue;
          totalWeightedDays += avgDays * count;

          return {
            stageId: Array.isArray(g.stage_id) ? g.stage_id[0] : g.stage_id,
            stageName: Array.isArray(g.stage_id) ? g.stage_id[1] : 'Sin etapa',
            count,
            totalRevenue: revenue,
            avgDaysStuck: avgDays,
          };
        });

      // Top stale opportunities with detail
      const staleRecords = await odoo.searchRead<{
        id: number;
        name: string;
        partner_id: [number, string] | false;
        stage_id: [number, string] | false;
        date_last_stage_update: string;
        expected_revenue: number;
        user_id: [number, string] | false;
      }>(
        'crm.lead',
        domain,
        {
          fields: ['name', 'partner_id', 'stage_id', 'date_last_stage_update', 'expected_revenue', 'user_id'],
          limit: input.limit,
          order: 'expected_revenue desc',
        }
      );

      const topStaleOpportunities: StaleOpportunity[] = staleRecords.map((r) => ({
        id: r.id,
        name: r.name,
        partner: Array.isArray(r.partner_id) ? r.partner_id[1] : 'Sin contacto',
        stage: Array.isArray(r.stage_id) ? r.stage_id[1] : 'Sin etapa',
        daysSinceUpdate: r.date_last_stage_update
          ? Math.round((now - new Date(r.date_last_stage_update).getTime()) / (1000 * 60 * 60 * 24))
          : input.staleDays,
        expectedRevenue: r.expected_revenue || 0,
        user: Array.isArray(r.user_id) ? r.user_id[1] : 'Sin asignar',
      }));

      const avgDaysStuck = totalStaleCount > 0 ? Math.round(totalWeightedDays / totalStaleCount) : 0;

      return success({
        totalStaleCount,
        totalStaleRevenue,
        avgDaysStuck,
        stageBreakdown,
        topStaleOpportunities,
        staleDaysThreshold: input.staleDays,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
