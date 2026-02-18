/**
 * Skill: get_user_activity
 *
 * Get recent activity of a specific Odoo user: messages sent, activities,
 * emails, orders created. Useful to infer interests, role, and profile.
 *
 * Use cases:
 * - "¿Qué hace este usuario en Odoo?"
 * - "Actividad reciente de María"
 * - "Inferir perfil profesional del usuario"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

export const GetUserActivityInputSchema = z.object({
  /** Odoo user ID */
  userId: z.number().optional(),
  /** Or filter by user name/login */
  userLogin: z.string().optional(),
  /** Days back to look */
  daysBack: z.number().int().min(1).max(365).default(30),
  /** Max messages to fetch */
  limit: z.number().int().min(1).max(100).default(50),
});

export interface UserActivityOutput {
  user: { id: number; name: string; login: string } | null;
  groups: string[];
  messages: { subject: string | null; bodyPreview: string; model: string | null; date: string; type: string }[];
  activities: { summary: string | null; type: string; deadline: string; model: string; state: string }[];
  modelInteractions: Record<string, number>;
  totalMessages: number;
  totalActivities: number;
}

function stripHtml(html: string, maxLen = 500): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export const getUserActivity: Skill<typeof GetUserActivityInputSchema, UserActivityOutput> = {
  name: 'get_user_activity',
  description: `Obtiene ACTIVIDAD RECIENTE de un usuario específico en Odoo: mensajes enviados, actividades asignadas, interacciones por modelo.
USAR PARA: "qué hace este usuario", "actividad de X", "perfil profesional", "intereses del usuario", "en qué trabaja".
Sirve para inferir rol, áreas de interés y tono de comunicación del usuario.
Devuelve: mensajes recientes, actividades, distribución por modelo (sale.order, crm.lead, etc.).`,
  tool: 'odoo',
  tags: ['users', 'activity', 'profile'],
  inputSchema: GetUserActivityInputSchema,

  async execute(input): Promise<SkillResult<UserActivityOutput>> {
    const context = arguments[1];
    if (!context?.credentials?.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - input.daysBack);
      const since = sinceDate.toISOString().split('T')[0];

      // 1. Resolve user
      let userId = input.userId;
      let userName = '';
      let userLogin = '';

      if (!userId && input.userLogin) {
        const users = await odoo.searchRead<{
          id: number; name: string; login: string;
        }>('res.users', [['login', '=', input.userLogin]], {
          fields: ['name', 'login'], limit: 1,
        });
        if (users.length > 0) {
          userId = users[0].id;
          userName = users[0].name;
          userLogin = users[0].login;
        }
      } else if (userId) {
        const users = await odoo.searchRead<{
          id: number; name: string; login: string;
        }>('res.users', [['id', '=', userId]], {
          fields: ['name', 'login'], limit: 1,
        });
        if (users.length > 0) {
          userName = users[0].name;
          userLogin = users[0].login;
        }
      }

      if (!userId) {
        const _descripcion = 'No se encontró el usuario especificado.';
        return success({
          _descripcion,
          user: null, groups: [], messages: [], activities: [],
          modelInteractions: {}, totalMessages: 0, totalActivities: 0,
        });
      }

      // 2. Fetch user groups (permissions) — strong signal of role
      let groups: string[] = [];
      try {
        const userWithGroups = await odoo.searchRead<{
          id: number; groups_id: number[];
        }>('res.users', [['id', '=', userId]], {
          fields: ['groups_id'], limit: 1,
        });
        if (userWithGroups[0]?.groups_id?.length) {
          const groupRecords = await odoo.searchRead<{
            id: number; full_name: string;
          }>('res.groups', [['id', 'in', userWithGroups[0].groups_id]], {
            fields: ['full_name'], limit: 200,
          });
          groups = groupRecords.map(g => g.full_name).filter(Boolean);
        }
      } catch { /* non-critical */ }

      // 3. Fetch messages authored by this user
      const msgDomain: OdooDomain = [
        ['author_id.user_ids', 'in', [userId]],
        ['date', '>=', since],
        ['message_type', 'in', ['comment', 'email']],
      ];

      const rawMessages = await odoo.searchRead<{
        id: number; subject: string | false; body: string;
        model: string | false; date: string; message_type: string;
      }>('mail.message', msgDomain, {
        fields: ['subject', 'body', 'model', 'date', 'message_type'],
        limit: input.limit,
        order: 'date desc',
      });

      const messages = rawMessages.map(m => ({
        subject: m.subject || null,
        bodyPreview: stripHtml(m.body || ''),
        model: m.model || null,
        date: m.date,
        type: m.message_type,
      }));

      // 4. Fetch activities assigned to this user
      const actDomain: OdooDomain = [
        ['user_id', '=', userId],
        ['date_deadline', '>=', since],
      ];

      const rawActivities = await odoo.searchRead<{
        id: number; summary: string | false;
        activity_type_id: [number, string]; date_deadline: string;
        res_model: string; state: string;
      }>('mail.activity', actDomain, {
        fields: ['summary', 'activity_type_id', 'date_deadline', 'res_model', 'state'],
        limit: input.limit,
        order: 'date_deadline desc',
      });

      const stateLabels: Record<string, string> = {
        overdue: 'Vencida', today: 'Hoy', planned: 'Planificada',
      };

      const activities = rawActivities.map(a => ({
        summary: a.summary || null,
        type: a.activity_type_id[1],
        deadline: a.date_deadline,
        model: a.res_model,
        state: stateLabels[a.state] || a.state,
      }));

      // 5. Count interactions by model
      const modelInteractions: Record<string, number> = {};
      messages.forEach(m => {
        if (m.model) modelInteractions[m.model] = (modelInteractions[m.model] || 0) + 1;
      });
      activities.forEach(a => {
        modelInteractions[a.model] = (modelInteractions[a.model] || 0) + 1;
      });

      // 6. Build _descripcion
      const modelSummary = Object.entries(modelInteractions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([m, c]) => `${m}: ${c}`)
        .join(', ');

      const topics = messages
        .filter(m => m.subject)
        .slice(0, 5)
        .map(m => m.subject)
        .join(', ');

      const _descripcion = `Actividad de ${userName} (${userLogin}) en los últimos ${input.daysBack} días: ${messages.length} mensajes, ${activities.length} actividades. Interacciones por modelo: ${modelSummary || 'sin datos'}. Temas recientes: ${topics || 'sin asuntos'}.`;

      return success({
        _descripcion,
        user: { id: userId, name: userName, login: userLogin },
        groups,
        messages,
        activities,
        modelInteractions,
        totalMessages: messages.length,
        totalActivities: activities.length,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
