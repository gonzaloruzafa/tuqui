/**
 * Skill: get_employee_leaves
 *
 * Get employee leave requests (vacations, absences, sick days).
 *
 * Use cases:
 * - "¿Quién está de vacaciones?"
 * - "Ausencias del mes"
 * - "Licencias pendientes de aprobación"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

export const GetEmployeeLeavesInputSchema = z.object({
  /** Filter by state: draft, confirm, validate, refuse */
  state: z.enum(['draft', 'confirm', 'validate', 'refuse']).optional(),
  /** Filter by employee name */
  employee: z.string().optional(),
  /** Only future/current leaves */
  upcomingOnly: z.boolean().default(false),
  /** Max results */
  limit: z.number().int().min(1).max(100).default(50),
});

export interface LeaveRow {
  id: number;
  employee: string;
  leaveType: string;
  dateFrom: string;
  dateTo: string;
  days: number;
  state: string;
}

export interface GetEmployeeLeavesOutput {
  leaves: LeaveRow[];
  total: number;
}

export const getEmployeeLeaves: Skill<typeof GetEmployeeLeavesInputSchema, GetEmployeeLeavesOutput> = {
  name: 'get_employee_leaves',
  description: `Obtiene AUSENCIAS y VACACIONES de empleados (licencias, sick days, permisos).
USAR PARA: "vacaciones", "ausencias", "quién está de licencia", "días pedidos", "faltas".
Devuelve: empleado, tipo de ausencia, fechas, días, estado (borrador/confirmado/aprobado/rechazado).`,
  tool: 'odoo',
  tags: ['hr', 'leaves', 'vacations'],
  inputSchema: GetEmployeeLeavesInputSchema,

  async execute(input): Promise<SkillResult<GetEmployeeLeavesOutput>> {
    const context = arguments[1];
    if (!context?.credentials?.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const domain: OdooDomain = [];

      if (input.state) domain.push(['state', '=', input.state]);
      if (input.employee) domain.push(['employee_id.name', 'ilike', input.employee]);
      if (input.upcomingOnly) {
        domain.push(['date_to', '>=', new Date().toISOString().split('T')[0]]);
      }

      const rows = await odoo.searchRead<{
        id: number;
        employee_id: [number, string];
        holiday_status_id: [number, string];
        date_from: string;
        date_to: string;
        number_of_days: number;
        state: string;
      }>(
        'hr.leave',
        domain,
        {
          fields: ['employee_id', 'holiday_status_id', 'date_from', 'date_to', 'number_of_days', 'state'],
          limit: input.limit,
          order: 'date_from desc',
        }
      );

      const stateLabels: Record<string, string> = {
        draft: 'Borrador', confirm: 'Confirmado', validate: 'Aprobado', refuse: 'Rechazado',
      };

      const leaves: LeaveRow[] = rows.map(r => ({
        id: r.id,
        employee: r.employee_id[1],
        leaveType: r.holiday_status_id[1],
        dateFrom: r.date_from,
        dateTo: r.date_to,
        days: r.number_of_days,
        state: stateLabels[r.state] || r.state,
      }));

      const byType: Record<string, number> = {};
      leaves.forEach(l => { byType[l.leaveType] = (byType[l.leaveType] || 0) + l.days; });
      const typeSummary = Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .map(([t, d]) => `${t}: ${d} días`)
        .join(', ');

      const totalDays = leaves.reduce((s, l) => s + l.days, 0);

      const _descripcion = `Se encontraron ${leaves.length} registros de ausencias (${totalDays} días total). Desglose por tipo: ${typeSummary || 'sin datos'}.`;

      return success({ _descripcion, leaves, total: leaves.length });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
