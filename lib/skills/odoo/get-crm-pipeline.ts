/**
 * Skill: get_crm_pipeline
 *
 * Get CRM pipeline summary - open opportunities, revenue, stages.
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange } from './_client';
import { errorToResult } from '../errors';

export const GetCrmPipelineInputSchema = z.object({
  period: PeriodSchema.optional(),
  status: z.enum(['open', 'won', 'lost', 'all']).default('open'),
  userId: z.number().int().positive().optional(),
  groupByStage: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(50),
});

export interface PipelineStage {
  stageId: number;
  stageName: string;
  count: number;
  expectedRevenue: number;
  avgProbability: number;
}

export interface CrmPipelineOutput {
  totalOpportunities: number;
  totalExpectedRevenue: number;
  avgProbability: number;
  stages: PipelineStage[];
  wonCount?: number;
  lostCount?: number;
  period?: { start: string; end: string; label?: string };
}

export const getCrmPipeline: Skill<
  typeof GetCrmPipelineInputSchema,
  CrmPipelineOutput
> = {
  name: 'get_crm_pipeline',

  description: `Pipeline de oportunidades del CRM - cuántas oportunidades hay, cuánta guita representan, en qué etapa están.
USAR PARA: "pipeline", "oportunidades", "cuántas oportunidades", "funnel de ventas",
"cuánta guita hay en el pipeline", "oportunidades abiertas/ganadas/perdidas",
"cuántas oportunidades ganamos", "¿cómo viene el pipeline?".
Soporta filtros por vendedor (userId) y estado (open/won/lost/all).`,

  tool: 'odoo',
  tags: ['crm', 'pipeline', 'sales', 'opportunities', 'reporting'],
  inputSchema: GetCrmPipelineInputSchema,

  async execute(input, context): Promise<SkillResult<CrmPipelineOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const domain: any[] = [['type', '=', 'opportunity']];

      if (input.status === 'open') {
        domain.push(['active', '=', true]);
        domain.push(['probability', '<', 100]);
      } else if (input.status === 'won') {
        domain.push(['probability', '=', 100]);
        domain.push(['active', '=', true]);
      } else if (input.status === 'lost') {
        domain.push(['active', '=', false]);
        domain.push(['probability', '=', 0]);
      }

      if (input.period) {
        domain.push(...dateRange('create_date', input.period.start, input.period.end));
      }

      if (input.userId) {
        domain.push(['user_id', '=', input.userId]);
      }

      let stages: PipelineStage[] = [];
      let totalOpportunities = 0;
      let totalExpectedRevenue = 0;
      let totalProbability = 0;

      if (input.groupByStage !== false) {
        const grouped = await odoo.readGroup(
          'crm.lead',
          domain,
          ['stage_id', 'expected_revenue:sum', 'probability:avg'],
          ['stage_id'],
          { limit: 20, orderBy: 'stage_id asc' }
        );

        stages = grouped
          .filter((g) => g.stage_id)
          .map((g) => {
            const count = g.stage_id_count || g.__count || 0;
            totalOpportunities += count;
            const revenue = g.expected_revenue || 0;
            totalExpectedRevenue += revenue;
            const prob = g.probability || 0;
            totalProbability += prob * count;

            return {
              stageId: Array.isArray(g.stage_id) ? g.stage_id[0] : g.stage_id,
              stageName: Array.isArray(g.stage_id) ? g.stage_id[1] : 'Sin etapa',
              count,
              expectedRevenue: revenue,
              avgProbability: Math.round(prob),
            };
          });
      } else {
        totalOpportunities = await odoo.searchCount('crm.lead', domain);
        if (totalOpportunities > 0) {
          const agg = await odoo.readGroup('crm.lead', domain, ['expected_revenue:sum', 'probability:avg'], [], { limit: 1 });
          if (agg.length > 0) {
            totalExpectedRevenue = agg[0].expected_revenue || 0;
            totalProbability = (agg[0].probability || 0) * totalOpportunities;
          }
        }
      }

      const avgProbability = totalOpportunities > 0 ? Math.round(totalProbability / totalOpportunities) : 0;

      let wonCount: number | undefined;
      let lostCount: number | undefined;

      if (input.status === 'all') {
        const wonDomain: any[] = [['type', '=', 'opportunity'], ['probability', '=', 100], ['active', '=', true]];
        if (input.period) wonDomain.push(...dateRange('create_date', input.period.start, input.period.end));
        wonCount = await odoo.searchCount('crm.lead', wonDomain);

        const lostDomain: any[] = [['type', '=', 'opportunity'], ['active', '=', false], ['probability', '=', 0]];
        if (input.period) lostDomain.push(...dateRange('create_date', input.period.start, input.period.end));
        lostCount = await odoo.searchCount('crm.lead', lostDomain);
      }

      return success({
        totalOpportunities,
        totalExpectedRevenue,
        avgProbability,
        stages,
        wonCount,
        lostCount,
        period: input.period,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
