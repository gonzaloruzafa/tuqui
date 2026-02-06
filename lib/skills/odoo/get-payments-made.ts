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
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetPaymentsMadeInputSchema = z.object({
  period: PeriodSchema.optional(),
  groupByJournal: z.boolean().default(false),
  groupBySupplier: z.boolean().default(false),
  journalIds: z.array(z.number().positive()).optional(),
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

  description: `Pagos realizados a proveedores (egresos).
USAR PARA: "cuánto pagamos", "pagos a proveedores", "egresos del mes", "cuánto se pagó", "pagos realizados".
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

      const baseDomain: OdooDomain = [
        ['payment_type', '=', 'outbound'],
        ['partner_type', '=', 'supplier'],
        ['state', '=', 'paid'],
      ];

      let domain: OdooDomain = combineDomains(baseDomain, dateRange('date', period.start, period.end));

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

      return success({ totalAmount, paymentCount, byJournal, bySupplier, period });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
