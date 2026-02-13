/**
 * Skill: search_crm_opportunities
 *
 * List individual CRM opportunities with flexible filters (stage, tag, seller,
 * customer) and optionally enrich with linked quotes (sale.order).
 * Answers: "What opportunities do I have in stage X with tag Y?"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange } from './_client';
import { errorToResult } from '../errors';

export const SearchCrmOpportunitiesInputSchema = z.object({
  /** Filter by stage. Obtener de get_crm_pipeline, NO adivinar. */
  stageId: z.number().int().positive().optional(),
  /** Filter by CRM tag. Obtener de get_crm_tags, NO adivinar. */
  tagId: z.number().int().positive().optional(),
  /** Filter by salesperson */
  userId: z.number().int().positive().optional(),
  /** Filter by customer */
  partnerId: z.number().int().positive().optional(),
  /** Filter by status */
  status: z.enum(['open', 'won', 'lost', 'all']).default('open'),
  /** Time period on create_date */
  period: PeriodSchema.optional(),
  /** Include linked sale orders (quotes/budgets) */
  includeQuotes: z.boolean().default(false),
  /** Max results */
  limit: z.number().int().min(1).max(50).default(20),
});

export interface OpportunityQuote {
  id: number;
  name: string;
  amountTotal: number;
  state: string;
}

export interface CrmOpportunityResult {
  id: number;
  name: string;
  partner: string;
  partnerEmail?: string;
  partnerPhone?: string;
  stage: string;
  tags: string[];
  expectedRevenue: number;
  probability: number;
  user: string;
  createDate: string;
  dateClosed?: string;
  /** Only if includeQuotes=true */
  quotes?: OpportunityQuote[];
  quotesTotal?: number;
}

export interface SearchCrmOpportunitiesOutput {
  totalCount: number;
  totalExpectedRevenue: number;
  opportunities: CrmOpportunityResult[];
}

export const searchCrmOpportunities: Skill<
  typeof SearchCrmOpportunitiesInputSchema,
  SearchCrmOpportunitiesOutput
> = {
  name: 'search_crm_opportunities',

  description: `Lista oportunidades del CRM con filtros combinados — etapa, etiqueta, vendedor, cliente.
USAR PARA: "oportunidades con etiqueta X", "oportunidades en etapa calificación",
"oportunidades de cliente X", "qué presupuestos tienen las oportunidades",
"oportunidades con presupuesto", "listar oportunidades", "detalle de oportunidades",
"oportunidades del vendedor X en etapa Y".
Puede incluir presupuestos (sale.order) vinculados a cada oportunidad.
IMPORTANTE: Usar get_crm_tags para obtener tagId, get_crm_pipeline para stageId.`,

  tool: 'odoo',
  tags: ['crm', 'pipeline', 'search', 'opportunities', 'quotes'],
  inputSchema: SearchCrmOpportunitiesInputSchema,

  async execute(input, context): Promise<SkillResult<SearchCrmOpportunitiesOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const domain: any[] = [['type', '=', 'opportunity']];

      // Status filter
      if (input.status === 'open') {
        domain.push(['active', '=', true], ['probability', '<', 100]);
      } else if (input.status === 'won') {
        domain.push(['probability', '=', 100], ['active', '=', true]);
      } else if (input.status === 'lost') {
        domain.push(['active', '=', false], ['probability', '=', 0]);
      }

      if (input.stageId) domain.push(['stage_id', '=', input.stageId]);
      if (input.tagId) domain.push(['tag_ids', 'in', [input.tagId]]);
      if (input.userId) domain.push(['user_id', '=', input.userId]);
      if (input.partnerId) domain.push(['partner_id', '=', input.partnerId]);
      if (input.period) domain.push(...dateRange('create_date', input.period.start, input.period.end));

      const fields = [
        'name', 'partner_id', 'stage_id', 'tag_ids', 'expected_revenue',
        'probability', 'user_id', 'create_date', 'date_closed',
      ];
      if (input.includeQuotes) fields.push('order_ids');

      const records = await odoo.searchRead<any>(
        'crm.lead',
        domain,
        { fields, limit: input.limit, order: 'expected_revenue desc' }
      );

      // Get total count if there could be more
      const totalCount = records.length < input.limit
        ? records.length
        : await odoo.searchCount('crm.lead', domain);

      // Enrich with partner contact info
      const partnerIds = [...new Set(
        records
          .filter((r: any) => Array.isArray(r.partner_id))
          .map((r: any) => r.partner_id[0])
      )];

      const contactMap = new Map<number, { email?: string; phone?: string }>();
      if (partnerIds.length > 0) {
        const contacts = await odoo.searchRead<{ id: number; email: string; phone: string }>(
          'res.partner',
          [['id', 'in', partnerIds]],
          { fields: ['id', 'email', 'phone'] }
        );
        contacts.forEach((c) => contactMap.set(c.id, { email: c.email || undefined, phone: c.phone || undefined }));
      }

      // Enrich with tag names
      const allTagIds = [...new Set(records.flatMap((r: any) => r.tag_ids || []))];
      const tagMap = new Map<number, string>();
      if (allTagIds.length > 0) {
        const tags = await odoo.searchRead<{ id: number; name: string }>(
          'crm.tag',
          [['id', 'in', allTagIds]],
          { fields: ['id', 'name'] }
        );
        tags.forEach((t) => tagMap.set(t.id, t.name));
      }

      // Enrich with quotes if requested
      const quotesMap = new Map<number, OpportunityQuote[]>();
      if (input.includeQuotes) {
        const allOrderIds = [...new Set(records.flatMap((r: any) => r.order_ids || []))];
        if (allOrderIds.length > 0) {
          const orders = await odoo.searchRead<{
            id: number; name: string; amount_total: number; state: string;
          }>(
            'sale.order',
            [['id', 'in', allOrderIds]],
            { fields: ['id', 'name', 'amount_total', 'state'] }
          );
          const orderById = new Map(orders.map((o) => [o.id, o]));

          for (const r of records) {
            const orderIds: number[] = r.order_ids || [];
            if (orderIds.length > 0) {
              quotesMap.set(
                r.id,
                orderIds
                  .map((oid: number) => orderById.get(oid))
                  .filter(Boolean)
                  .map((o: any) => ({
                    id: o.id,
                    name: o.name,
                    amountTotal: o.amount_total || 0,
                    state: o.state,
                  }))
              );
            }
          }
        }
      }

      let totalExpectedRevenue = 0;
      const opportunities: CrmOpportunityResult[] = records.map((r: any) => {
        const partnerId = Array.isArray(r.partner_id) ? r.partner_id[0] : null;
        const contact = partnerId ? contactMap.get(partnerId) : undefined;
        const quotes = quotesMap.get(r.id);
        totalExpectedRevenue += r.expected_revenue || 0;

        return {
          id: r.id,
          name: r.name,
          partner: Array.isArray(r.partner_id) ? r.partner_id[1] : 'Sin contacto',
          partnerEmail: contact?.email,
          partnerPhone: contact?.phone,
          stage: Array.isArray(r.stage_id) ? r.stage_id[1] : 'Sin etapa',
          tags: (r.tag_ids || []).map((tid: number) => tagMap.get(tid) || `Tag ${tid}`),
          expectedRevenue: r.expected_revenue || 0,
          probability: r.probability || 0,
          user: Array.isArray(r.user_id) ? r.user_id[1] : 'Sin asignar',
          createDate: r.create_date || '',
          dateClosed: r.date_closed || undefined,
          quotes,
          quotesTotal: quotes ? quotes.reduce((sum, q) => sum + q.amountTotal, 0) : undefined,
        };
      });

      return success({
        totalCount,
        totalExpectedRevenue,
        opportunities,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
