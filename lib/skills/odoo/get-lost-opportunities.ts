/**
 * Skill: get_lost_opportunities
 *
 * Analyzes why opportunities are being lost — top reasons, revenue impact,
 * and biggest lost deals.
 * Answers: "Why are we losing?" "What's the #1 loss reason?"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange, getDefaultPeriod, formatMonto } from './_client';
import { errorToResult } from '../errors';

export const GetLostOpportunitiesInputSchema = z.object({
  /** Period to analyze (required) */
  period: PeriodSchema.optional(),
  /** Filter by salesperson */
  userId: z.number().int().positive().optional(),
  /** Filter by CRM tag */
  tagId: z.number().int().positive().optional(),
  /** Max individual deals to return */
  limit: z.number().int().min(1).max(50).default(10),
});

export interface LostReason {
  reasonId: number | null;
  reasonName: string;
  count: number;
  totalRevenue: number;
  percentage: number;
}

export interface LostDeal {
  id: number;
  name: string;
  partner: string;
  reason: string;
  expectedRevenue: number;
  stage: string;
  dateClosed: string;
  user: string;
}

export interface LostOpportunitiesOutput {
  totalLost: number;
  totalLostRevenue: number;
  lostReasons: LostReason[];
  topLostDeals: LostDeal[];
  period: { start: string; end: string; label?: string };
}

export const getLostOpportunities: Skill<
  typeof GetLostOpportunitiesInputSchema,
  LostOpportunitiesOutput
> = {
  name: 'get_lost_opportunities',

  description: `Analiza por qué estamos perdiendo oportunidades — ranking de causas y plata perdida.
USAR PARA: "por qué perdimos", "causa de pérdida", "oportunidades perdidas",
"cuánta guita perdimos", "motivo de pérdida", "análisis de pérdidas",
"por qué no cerramos", "razones de rechazo", "qué nos dicen cuando nos dicen que no".
Muestra ranking de causas (precio, competencia, etc.) con el revenue perdido por cada una.
Incluye los deals más grandes que se perdieron.`,

  tool: 'odoo',
  tags: ['crm', 'pipeline', 'lost', 'analysis', 'opportunities'],
  inputSchema: GetLostOpportunitiesInputSchema,

  async execute(input, context): Promise<SkillResult<LostOpportunitiesOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      // Lost = active=False, probability=0, with date_closed in period
      const domain: any[] = [
        ['type', '=', 'opportunity'],
        ['active', '=', false],
        ['probability', '=', 0],
      ];

      // Use date_closed for period filter (when was it lost)
      domain.push(...dateRange('date_closed', period.start, period.end));

      if (input.userId) {
        domain.push(['user_id', '=', input.userId]);
      }
      if (input.tagId) {
        domain.push(['tag_ids', 'in', [input.tagId]]);
      }

      // Group by lost_reason_id to get ranking
      const grouped = await odoo.readGroup(
        'crm.lead',
        domain,
        ['lost_reason_id', 'expected_revenue:sum'],
        ['lost_reason_id'],
        { limit: 20, orderBy: 'expected_revenue desc' }
      );

      let totalLost = 0;
      let totalLostRevenue = 0;

      const rawReasons = grouped.map((g) => {
        const count = g.lost_reason_id_count || g.__count || 0;
        const revenue = g.expected_revenue || 0;
        totalLost += count;
        totalLostRevenue += revenue;
        return {
          reasonId: Array.isArray(g.lost_reason_id) ? g.lost_reason_id[0] : null,
          reasonName: Array.isArray(g.lost_reason_id) ? g.lost_reason_id[1] : 'Sin motivo especificado',
          count,
          totalRevenue: revenue,
          percentage: 0,
        };
      });

      // Calculate percentages
      const lostReasons: LostReason[] = rawReasons.map((r) => ({
        ...r,
        percentage: totalLost > 0 ? Math.round((r.count / totalLost) * 100) : 0,
      }));

      // Top lost deals with detail
      const lostRecords = await odoo.searchRead<{
        id: number;
        name: string;
        partner_id: [number, string] | false;
        lost_reason_id: [number, string] | false;
        expected_revenue: number;
        stage_id: [number, string] | false;
        date_closed: string;
        user_id: [number, string] | false;
      }>(
        'crm.lead',
        domain,
        {
          fields: ['name', 'partner_id', 'lost_reason_id', 'expected_revenue', 'stage_id', 'date_closed', 'user_id'],
          limit: input.limit,
          order: 'expected_revenue desc',
        }
      );

      const topLostDeals: LostDeal[] = lostRecords.map((r) => ({
        id: r.id,
        name: r.name,
        partner: Array.isArray(r.partner_id) ? r.partner_id[1] : 'Sin contacto',
        reason: Array.isArray(r.lost_reason_id) ? r.lost_reason_id[1] : 'Sin motivo',
        expectedRevenue: r.expected_revenue || 0,
        stage: Array.isArray(r.stage_id) ? r.stage_id[1] : 'Sin etapa',
        dateClosed: r.date_closed || '',
        user: Array.isArray(r.user_id) ? r.user_id[1] : 'Sin asignar',
      }));

      const topReason = lostReasons.length > 0 ? lostReasons[0].reasonName : 'sin datos';
      const _descripcion = `OPORTUNIDADES PERDIDAS: ${totalLost} oportunidades perdidas por ${formatMonto(totalLostRevenue)} en el período ${period.start} a ${period.end}. Principal causa: ${topReason} (${lostReasons.length > 0 ? lostReasons[0].percentage : 0}%). Top ${topLostDeals.length} deals perdidos incluidos. IMPORTANTE: los partners son CLIENTES POTENCIALES que se perdieron, NO son vendedores.`;

      return success({
        _descripcion,
        totalLost,
        totalLostRevenue,
        lostReasons,
        topLostDeals,
        period,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
