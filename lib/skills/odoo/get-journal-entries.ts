/**
 * Skill: get_journal_entries
 *
 * Retrieves journal entries (asientos contables) from account.move.
 * Supports filtering by type, account code, and period.
 *
 * @example
 * User: "Asientos contables de enero"
 * User: "Notas de crédito del mes"
 * User: "Movimientos de la cuenta 5.1"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult, Period } from '../types';
import { PeriodSchema, success, authError } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod, formatMonto, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

const MoveTypeEnum = z.enum([
  'entry',        // Asiento contable manual
  'out_invoice',  // Factura de cliente
  'in_invoice',   // Factura de proveedor
  'out_refund',   // Nota de crédito cliente
  'in_refund',    // Nota de crédito proveedor
]);

export const GetJournalEntriesInputSchema = z.object({
  period: PeriodSchema.optional(),
  /** Filter by move type(s) */
  moveType: z.union([MoveTypeEnum, z.array(MoveTypeEnum)]).optional(),
  /** Filter by account code prefix in lines (e.g. "5.1" for expenses) */
  accountCode: z.string().optional(),
  /** Filter by customer/partner name (partial match via ilike) */
  customerName: z.string().optional(),
  /** Filter by exact partner ID */
  partnerId: z.number().int().positive().optional(),
  /** Company ID. Obtener de get_companies, NO adivinar. */
  companyId: z.number().int().positive().optional(),
  state: z.enum(['all', 'posted', 'draft']).default('posted'),
  limit: z.number().min(1).max(100).default(50),
});

export type GetJournalEntriesInput = z.infer<typeof GetJournalEntriesInputSchema>;

// ============================================
// OUTPUT TYPES
// ============================================

export interface JournalEntry {
  id: number;
  name: string;
  date: string;
  moveType: string;
  partnerName: string;
  journalName: string;
  amount: number;
  state: string;
}

export interface GetJournalEntriesOutput {
  entries: JournalEntry[];
  totalAmount: number;
  entryCount: number;
  period: Period;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getJournalEntries: Skill<typeof GetJournalEntriesInputSchema, GetJournalEntriesOutput> = {
  name: 'get_journal_entries',

  description: `Asientos contables / journal entries. Puede filtrar por cliente con customerName.
USAR PARA: "asientos contables", "notas de crédito", "movimientos contables", "asientos de la cuenta X",
"facturas de Cliente X" (con moveType=out_invoice + customerName).
Soporta filtro por compañía (companyId). SIEMPRE llamar get_companies primero para obtener el ID.
RETORNA: name (número de factura/asiento, ej FAC-A 00001-00000123), monto, partner, diario.`,

  tool: 'odoo',
  inputSchema: GetJournalEntriesInputSchema,
  tags: ['accounting', 'journal', 'entries', 'moves'],
  priority: 10,

  async execute(input: GetJournalEntriesInput, context: SkillContext): Promise<SkillResult<GetJournalEntriesOutput>> {
    if (!context.credentials.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      let domain: OdooDomain = combineDomains(
        [],
        dateRange('date', period.start, period.end)
      );

      // State filter
      if (input.state !== 'all') {
        domain = [...domain, ['state', '=', input.state]];
      }

      // Move type filter
      if (input.moveType) {
        const types = Array.isArray(input.moveType) ? input.moveType : [input.moveType];
        domain = [...domain, ['move_type', 'in', types]];
      }

      // Company filter
      if (input.companyId) {
        domain = [...domain, ['company_id', '=', input.companyId]];
      }

      // Customer/partner filter
      if (input.customerName) {
        domain = [...domain, ['partner_id.name', 'ilike', input.customerName]];
      }
      if (input.partnerId) {
        domain = [...domain, ['partner_id', '=', input.partnerId]];
      }

      // Account code filter: find move IDs that have lines matching the account
      if (input.accountCode) {
        const lines = await odoo.searchRead<{ move_id: any }>(
          'account.move.line',
          [
            ['account_id.code', '=like', `${input.accountCode}%`],
            ['parent_state', '=', input.state === 'all' ? 'posted' : input.state],
          ],
          { fields: ['move_id'], limit: 10000 }
        );

        const moveIds = [...new Set(
          lines.map((l) => (Array.isArray(l.move_id) ? l.move_id[0] : l.move_id))
        )];

        if (moveIds.length === 0) {
          const _descripcion = `ASIENTOS CONTABLES: no se encontraron movimientos para la cuenta ${input.accountCode} en el período ${period.start} a ${period.end}. IMPORTANTE: son movimientos contables, los partners pueden ser clientes o proveedores según el tipo de asiento.`;

          return success({ _descripcion, entries: [], totalAmount: 0, entryCount: 0, period });
        }
        domain = [...domain, ['id', 'in', moveIds]];
      }

      const moves = await odoo.searchRead<{
        id: number;
        name: string;
        date: string;
        move_type: string;
        partner_id: any;
        journal_id: any;
        amount_total: number;
        state: string;
      }>(
        'account.move',
        domain,
        {
          fields: ['name', 'date', 'move_type', 'partner_id', 'journal_id', 'amount_total', 'state'],
          limit: input.limit,
          order: 'date desc, id desc',
        }
      );

      const entries: JournalEntry[] = moves.map((m) => ({
        id: m.id,
        name: m.name || '',
        date: m.date,
        moveType: m.move_type,
        partnerName: Array.isArray(m.partner_id) ? m.partner_id[1] : '',
        journalName: Array.isArray(m.journal_id) ? m.journal_id[1] : '',
        amount: m.amount_total || 0,
        state: m.state,
      }));

      const totalAmount = entries.reduce((s, e) => s + e.amount, 0);

      const _descripcion = `ASIENTOS CONTABLES: ${entries.length} asientos por ${formatMonto(totalAmount)}. Período: ${period.start} a ${period.end}. IMPORTANTE: son movimientos contables, los partners pueden ser clientes o proveedores según el tipo de asiento.`;

      return success({ _descripcion, entries, totalAmount, entryCount: entries.length, period });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
