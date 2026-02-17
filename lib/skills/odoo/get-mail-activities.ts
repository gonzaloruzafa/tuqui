/**
 * Skill: get_mail_activities
 *
 * Get scheduled activities (tasks, to-dos, calls, meetings) from Odoo.
 *
 * Use cases:
 * - "Actividades pendientes"
 * - "¿Qué tareas hay para hoy?"
 * - "Actividades vencidas"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

export const GetMailActivitiesInputSchema = z.object({
  /** Filter by state: overdue, today, planned */
  state: z.enum(['overdue', 'today', 'planned']).optional(),
  /** Filter by responsible user name */
  user: z.string().optional(),
  /** Filter by model (sale.order, crm.lead, etc.) */
  model: z.string().optional(),
  /** Max results */
  limit: z.number().int().min(1).max(100).default(50),
});

export interface ActivityRow {
  id: number;
  summary: string | null;
  note: string | null;
  activityType: string;
  deadline: string;
  user: string;
  model: string;
  state: string;
}

export interface GetMailActivitiesOutput {
  activities: ActivityRow[];
  total: number;
}

export const getMailActivities: Skill<typeof GetMailActivitiesInputSchema, GetMailActivitiesOutput> = {
  name: 'get_mail_activities',
  description: `Obtiene ACTIVIDADES programadas en Odoo (tareas, llamadas, reuniones, to-dos).
USAR PARA: "actividades pendientes", "tareas por hacer", "actividades vencidas", "próximas llamadas", "agenda de seguimiento".
Devuelve: resumen, tipo, fecha límite, responsable, modelo relacionado, estado.`,
  tool: 'odoo',
  tags: ['mail', 'activities', 'tasks'],
  inputSchema: GetMailActivitiesInputSchema,

  async execute(input): Promise<SkillResult<GetMailActivitiesOutput>> {
    const context = arguments[1];
    if (!context?.credentials?.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const domain: OdooDomain = [];

      if (input.state) domain.push(['state', '=', input.state]);
      if (input.user) domain.push(['user_id.name', 'ilike', input.user]);
      if (input.model) domain.push(['res_model', '=', input.model]);

      const rows = await odoo.searchRead<{
        id: number;
        summary: string | false;
        note: string | false;
        activity_type_id: [number, string];
        date_deadline: string;
        user_id: [number, string];
        res_model: string;
        state: string;
      }>(
        'mail.activity',
        domain,
        {
          fields: ['summary', 'note', 'activity_type_id', 'date_deadline', 'user_id', 'res_model', 'state'],
          limit: input.limit,
          order: 'date_deadline asc',
        }
      );

      const stateLabels: Record<string, string> = {
        overdue: 'Vencida', today: 'Hoy', planned: 'Planificada',
      };

      const activities: ActivityRow[] = rows.map(r => ({
        id: r.id,
        summary: r.summary || null,
        note: r.note ? r.note.replace(/<[^>]*>/g, '').slice(0, 200) : null,
        activityType: r.activity_type_id[1],
        deadline: r.date_deadline,
        user: r.user_id[1],
        model: r.res_model,
        state: stateLabels[r.state] || r.state,
      }));

      const byState: Record<string, number> = {};
      activities.forEach(a => { byState[a.state] = (byState[a.state] || 0) + 1; });
      const stateSummary = Object.entries(byState).map(([s, c]) => `${s}: ${c}`).join(', ');

      const byType: Record<string, number> = {};
      activities.forEach(a => { byType[a.activityType] = (byType[a.activityType] || 0) + 1; });
      const typeSummary = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}: ${c}`).join(', ');

      const _descripcion = `Hay ${activities.length} actividades. Por estado: ${stateSummary}. Por tipo: ${typeSummary}. Responsables: ${[...new Set(activities.map(a => a.user))].slice(0, 10).join(', ')}.`;

      return success({ _descripcion, activities, total: activities.length });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
