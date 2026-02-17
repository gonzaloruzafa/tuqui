/**
 * Skill: get_leave_summary
 *
 * Aggregated leave statistics by type using readGroup.
 *
 * Use cases:
 * - "Resumen de ausencias"
 * - "¿Cuántos días de vacaciones se tomaron?"
 * - "Estadísticas de licencias"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

export const GetLeaveSummaryInputSchema = z.object({
  /** Only approved leaves */
  approvedOnly: z.boolean().default(true),
  /** Period start (YYYY-MM-DD) */
  dateFrom: z.string().optional(),
  /** Period end (YYYY-MM-DD) */
  dateTo: z.string().optional(),
});

export interface LeaveSummaryRow {
  leaveType: string;
  totalDays: number;
  count: number;
}

export interface GetLeaveSummaryOutput {
  summary: LeaveSummaryRow[];
  totalDays: number;
  totalRequests: number;
}

export const getLeaveSummary: Skill<typeof GetLeaveSummaryInputSchema, GetLeaveSummaryOutput> = {
  name: 'get_leave_summary',
  description: `Resumen AGREGADO de ausencias/vacaciones agrupado por tipo de licencia.
USAR PARA: "resumen de vacaciones", "estadísticas de ausencias", "cuántos días se tomaron", "balance de licencias".
Devuelve: tipo de licencia, total días, cantidad de solicitudes.`,
  tool: 'odoo',
  tags: ['hr', 'leaves', 'analytics'],
  inputSchema: GetLeaveSummaryInputSchema,

  async execute(input): Promise<SkillResult<GetLeaveSummaryOutput>> {
    const context = arguments[1];
    if (!context?.credentials?.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const domain: OdooDomain = [];

      if (input.approvedOnly) domain.push(['state', '=', 'validate']);
      if (input.dateFrom) domain.push(['date_from', '>=', input.dateFrom]);
      if (input.dateTo) domain.push(['date_to', '<=', input.dateTo]);

      const groups = await odoo.readGroup(
        'hr.leave',
        domain,
        ['number_of_days:sum'],
        ['holiday_status_id']
      );

      const summary: LeaveSummaryRow[] = groups.map((g: any) => ({
        leaveType: g.holiday_status_id?.[1] || 'Desconocido',
        totalDays: g.number_of_days || 0,
        count: g.__count || 0,
      }));

      const totalDays = summary.reduce((s, r) => s + r.totalDays, 0);
      const totalRequests = summary.reduce((s, r) => s + r.count, 0);

      const lines = summary
        .sort((a, b) => b.totalDays - a.totalDays)
        .map(r => `${r.leaveType}: ${r.totalDays} días (${r.count} solicitudes)`)
        .join(', ');

      const _descripcion = `Resumen de ausencias: ${totalRequests} solicitudes, ${totalDays} días totales. Desglose: ${lines || 'sin datos'}.`;

      return success({ _descripcion, summary, totalDays, totalRequests });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
