/**
 * Skill: get_chatter_messages
 *
 * Read chatter/mail.message entries — internal notes, comments, logs.
 * Useful to understand communication tone, business rules, and context.
 *
 * Use cases:
 * - "Mensajes recientes del chatter"
 * - "¿Qué se discutió sobre este cliente?"
 * - "Tono de comunicación interna"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

export const GetChatterMessagesInputSchema = z.object({
  /** Filter by Odoo model (e.g. 'sale.order', 'res.partner', 'crm.lead') */
  model: z.string().optional(),
  /** Filter by record ID */
  resId: z.number().optional(),
  /** Message types: comment, notification, email */
  messageType: z.enum(['comment', 'notification', 'email']).optional(),
  /** Max results */
  limit: z.number().int().min(1).max(100).default(30),
});

export interface ChatterMessageRow {
  id: number;
  subject: string | null;
  bodyPreview: string;
  author: string | null;
  date: string;
  model: string | null;
  messageType: string;
}

export interface GetChatterMessagesOutput {
  messages: ChatterMessageRow[];
  total: number;
}

/** Strip HTML tags and truncate */
function stripHtml(html: string, maxLen = 500): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export const getChatterMessages: Skill<typeof GetChatterMessagesInputSchema, GetChatterMessagesOutput> = {
  name: 'get_chatter_messages',
  description: `Lee MENSAJES del chatter de Odoo (notas internas, comentarios, logs).
USAR PARA: "mensajes internos", "chatter", "discusiones", "comunicación interna", "tono de comunicación", "qué se dijo sobre X", "notas en el pedido".
Filtra por modelo (sale.order, res.partner, crm.lead, etc.) y tipo de mensaje.
Devuelve: asunto, texto (primeros 500 chars), autor, fecha, modelo.`,
  tool: 'odoo',
  tags: ['mail', 'chatter', 'communication'],
  inputSchema: GetChatterMessagesInputSchema,

  async execute(input): Promise<SkillResult<GetChatterMessagesOutput>> {
    const context = arguments[1];
    if (!context?.credentials?.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const domain: OdooDomain = [];

      if (input.model) domain.push(['model', '=', input.model]);
      if (input.resId) domain.push(['res_id', '=', input.resId]);
      if (input.messageType) domain.push(['message_type', '=', input.messageType]);

      // Exclude system notifications (tracking) for cleaner results
      if (!input.messageType) {
        domain.push(['message_type', 'in', ['comment', 'email']]);
      }

      const rows = await odoo.searchRead<{
        id: number;
        subject: string | false;
        body: string;
        author_id: [number, string] | false;
        date: string;
        model: string | false;
        message_type: string;
      }>(
        'mail.message',
        domain,
        {
          fields: ['subject', 'body', 'author_id', 'date', 'model', 'message_type'],
          limit: input.limit,
          order: 'date desc',
        }
      );

      const messages: ChatterMessageRow[] = rows.map(r => ({
        id: r.id,
        subject: r.subject || null,
        bodyPreview: stripHtml(r.body || ''),
        author: r.author_id ? r.author_id[1] : null,
        date: r.date,
        model: r.model || null,
        messageType: r.message_type,
      }));

      const byModel: Record<string, number> = {};
      messages.forEach(m => {
        const k = m.model || 'sin modelo';
        byModel[k] = (byModel[k] || 0) + 1;
      });
      const modelSummary = Object.entries(byModel)
        .sort((a, b) => b[1] - a[1])
        .map(([m, c]) => `${m}: ${c}`)
        .join(', ');

      const authors = [...new Set(messages.map(m => m.author).filter(Boolean))];

      const _descripcion = `Se leyeron ${messages.length} mensajes del chatter. Por modelo: ${modelSummary}. Autores: ${authors.slice(0, 10).join(', ')}. Temas recientes: ${messages.slice(0, 5).map(m => m.subject || m.bodyPreview.slice(0, 80)).join(' | ')}.`;

      return success({ _descripcion, messages, total: messages.length });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
