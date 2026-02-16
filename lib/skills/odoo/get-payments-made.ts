/**
 * Skill: get_payments_made
 *
 * Retrieves payments made to suppliers (outbound payments).
 * Mirror of get-payments-received for the purchase side.
 *
 * @example
 * User: "¿Cuánto pagamos a proveedores?"
 * User: "Pagos realizados este mes"
 * User: "Egresos del día"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult, Period } from '../types';
import { PeriodSchema, success, authError } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod, formatMonto, type OdooDomain, type DomainFilter } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetPaymentsMadeInputSchema = z.object({
  period: PeriodSchema.optional(),
  groupByJournal: z.boolean().default(false),
  groupBySupplier: z.boolean().default(false),
  journalIds: z.array(z.number().positive()).optional(),
  /** Company ID. Obtener de get_companies, NO adivinar. */
  companyId: z.number().int().positive().optional(),
  limit: z.number().min(1).max(100).default(20),
});

export type GetPaymentsMadeInput = z.infer<typeof GetPaymentsMadeInputSchema>;

// ============================================
// OUTPUT TYPES
// ============================================

export interface PaymentGroup {
  groupId: number;
  groupName: string;
  amount: number;
  count: number;
}

export interface GetPaymentsMadeOutput {
  totalAmount: number;
  paymentCount: number;
  byJournal?: PaymentGroup[];
  bySupplier?: PaymentGroup[];
  period: Period;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getPaymentsMade: Skill<typeof GetPaymentsMadeInputSchema, GetPaymentsMadeOutput> = {
  name: 'get_payments_made',

  description: `Pagos realizados a proveedores (egresos) — SALIDAS de efectivo.
USAR PARA: "cuánto pagamos", "pagos a proveedores", "egresos del mes", "cuánto se pagó", "pagos realizados", "salidas de caja".
Soporta filtro por compañía (companyId). SIEMPRE llamar get_companies primero para obtener el ID.
PARA FLUJO DE CAJA: este tool da los EGRESOS. Combinar con get_payments_received (ingresos) y get_cash_balance (saldo actual).
Retorna total pagado, cantidad de pagos. Acepta período y agrupación por diario/proveedor.`,

  tool: 'odoo',
  inputSchema: GetPaymentsMadeInputSchema,
  tags: ['payments', 'outbound', 'suppliers', 'cash-flow'],
  priority: 10,

  async execute(input: GetPaymentsMadeInput, context: SkillContext): Promise<SkillResult<GetPaymentsMadeOutput>> {
    if (!context.credentials.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      const baseDomain: DomainFilter[] = [
        ['payment_type', '=', 'outbound'],
        ['partner_type', '=', 'supplier'],
        ['state', '=', 'paid'],
      ];

      let domain: OdooDomain = combineDomains(baseDomain, dateRange('date', period.start, period.end));

      // Filter by company
      if (input.companyId) {
        domain = [...domain, ['company_id', '=', input.companyId]];
      }

      if (input.journalIds?.length) {
        domain = [...domain, ['journal_id', 'in', input.journalIds]];
      }

      // Parallel queries
      const promises: Promise<any>[] = [
        odoo.readGroup('account.payment', domain, ['amount:sum'], [], { limit: 1 }),
      ];

      if (input.groupByJournal) {
        promises.push(
          odoo.readGroup('account.payment', domain, ['journal_id', 'amount:sum'], ['journal_id'], {
            limit: input.limit, orderBy: 'amount desc',
          })
        );
      }

      if (input.groupBySupplier) {
        promises.push(
          odoo.readGroup('account.payment', domain, ['partner_id', 'amount:sum'], ['partner_id'], {
            limit: input.limit, orderBy: 'amount desc',
          })
        );
      }

      const results = await Promise.all(promises);

      const totalAmount = results[0]?.[0]?.amount || 0;
      const paymentCount = results[0]?.[0]?.__count || 0;
      let idx = 1;

      let byJournal: PaymentGroup[] | undefined;
      if (input.groupByJournal) {
        byJournal = (results[idx++] || [])
          .filter((g: any) => g.journal_id)
          .map((g: any) => ({
            groupId: g.journal_id[0],
            groupName: g.journal_id[1],
            amount: g.amount || 0,
            count: g.journal_id_count || g.__count || 1,
          }));
      }

      let bySupplier: PaymentGroup[] | undefined;
      if (input.groupBySupplier) {
        bySupplier = (results[idx++] || [])
          .filter((g: any) => g.partner_id)
          .map((g: any) => ({
            groupId: g.partner_id[0],
            groupName: g.partner_id[1],
            amount: g.amount || 0,
            count: g.partner_id_count || g.__count || 1,
          }));
      }

      const _descripcion = `Pagos realizados a proveedores (${period.start} a ${period.end}): ${paymentCount} pagos por un total de ${formatMonto(totalAmount)}${byJournal ? `. Por diario: ${byJournal.map(j => `${j.groupName}: ${formatMonto(j.amount)}`).join(', ')}` : ''}${bySupplier ? `. Por proveedor: ${bySupplier.slice(0, 5).map(s => `${s.groupName}: ${formatMonto(s.amount)}`).join(', ')}` : ''}. IMPORTANTE: son pagos que NOSOTROS hicimos a PROVEEDORES, NO son cobros de clientes.`;

      return success({ _descripcion, totalAmount, paymentCount, byJournal, bySupplier, period });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
