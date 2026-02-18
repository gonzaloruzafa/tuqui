/**
 * Skill: get_recent_emails
 *
 * Get recent emails sent/received through Odoo (mail.message with type=email).
 *
 * Use cases:
 * - "Últimos emails"
 * - "Correos enviados a clientes"
 * - "Comunicaciones por email recientes"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

export const GetRecentEmailsInputSchema = z.object({
  /** Filter by model (sale.order, res.partner, etc.) */
  model: z.string().optional(),
  /** Filter by author name */
  author: z.string().optional(),
  /** Max results */
  limit: z.number().int().min(1).max(100).default(30),
});

export interface EmailRow {
  id: number;
  subject: string | null;
  bodyPreview: string;
  author: string | null;
  emailFrom: string | null;
  date: string;
  model: string | null;
}

export interface GetRecentEmailsOutput {
  emails: EmailRow[];
  total: number;
}

function stripHtml(html: string, maxLen = 500): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export const getRecentEmails: Skill<typeof GetRecentEmailsInputSchema, GetRecentEmailsOutput> = {
  name: 'get_recent_emails',
  description: `Obtiene EMAILS recientes enviados/recibidos por Odoo.
USAR PARA: "emails", "correos", "comunicaciones por email", "qué se envió", "últimos mails", "tono de comunicación con clientes".
Devuelve: asunto, preview del cuerpo, autor, email de origen, fecha, modelo relacionado.`,
  tool: 'odoo',
  tags: ['mail', 'emails'],
  inputSchema: GetRecentEmailsInputSchema,

  async execute(input): Promise<SkillResult<GetRecentEmailsOutput>> {
    const context = arguments[1];
    if (!context?.credentials?.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const domain: OdooDomain = [['message_type', '=', 'email']];

      if (input.model) domain.push(['model', '=', input.model]);
      if (input.author) domain.push(['author_id.name', 'ilike', input.author]);

      const rows = await odoo.searchRead<{
        id: number;
        subject: string | false;
        body: string;
        author_id: [number, string] | false;
        email_from: string | false;
        date: string;
        model: string | false;
      }>(
        'mail.message',
        domain,
        {
          fields: ['subject', 'body', 'author_id', 'email_from', 'date', 'model'],
          limit: input.limit,
          order: 'date desc',
        }
      );

      const emails: EmailRow[] = rows.map(r => ({
        id: r.id,
        subject: r.subject || null,
        bodyPreview: stripHtml(r.body || ''),
        author: r.author_id ? r.author_id[1] : null,
        emailFrom: r.email_from || null,
        date: r.date,
        model: r.model || null,
      }));

      const authors = [...new Set(emails.map(e => e.author).filter(Boolean))];
      const subjects = emails.slice(0, 5).map(e => e.subject || '(sin asunto)').join(', ');

      const _descripcion = `Se encontraron ${emails.length} emails recientes. Autores: ${authors.slice(0, 10).join(', ')}. Asuntos recientes: ${subjects}.`;

      return success({ _descripcion, emails, total: emails.length });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
