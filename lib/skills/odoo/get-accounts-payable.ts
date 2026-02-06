/**
 * Skill: get_accounts_payable
 *
 * Retrieves accounts payable (what we owe to suppliers).
 * Mirror of get-accounts-receivable for the purchase side.
 *
 * @example
 * User: "¿Cuánto le debemos a proveedores?"
 * User: "Cuentas por pagar"
 * User: "Deuda con proveedores"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult, Period } from '../types';
import { PeriodSchema, success, authError } from '../types';
import { createOdooClient, dateRange, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetAccountsPayableInputSchema = z.object({
  duePeriod: PeriodSchema.optional(),
  overdueOnly: z.boolean().default(false),
  groupBySupplier: z.boolean().default(false),
  limit: z.number().min(1).max(100).default(20),
});

export type GetAccountsPayableInput = z.infer<typeof GetAccountsPayableInputSchema>;

// ============================================
// OUTPUT TYPES
// ============================================

export interface SupplierPayable {
  supplierId: number;
  supplierName: string;
  amountOwed: number;
  billCount: number;
}

export interface GetAccountsPayableOutput {
  totalPayable: number;
  totalOverdue: number;
  billCount: number;
  supplierCount: number;
  bySupplier?: SupplierPayable[];
  currency: string;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getAccountsPayable: Skill<typeof GetAccountsPayableInputSchema, GetAccountsPayableOutput> = {
  name: 'get_accounts_payable',

  description: `Total de cuentas por pagar (deuda con proveedores).
USAR PARA: "cuánto debemos a proveedores", "cuentas por pagar", "accounts payable", "deuda total con proveedores", "cuánto hay que pagar".
Retorna total adeudado, total vencido, cantidad de facturas y proveedores.`,

  tool: 'odoo',
  inputSchema: GetAccountsPayableInputSchema,
  tags: ['accounting', 'payable', 'suppliers', 'debt'],
  priority: 14,

  async execute(input: GetAccountsPayableInput, context: SkillContext): Promise<SkillResult<GetAccountsPayableOutput>> {
    if (!context.credentials.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const today = new Date().toISOString().split('T')[0];

      // Base domain: posted supplier invoices with remaining balance
      let domain: OdooDomain = [
        ['state', '=', 'posted'],
        ['move_type', '=', 'in_invoice'],
        ['amount_residual', '>', 0],
      ];

      if (input.duePeriod) {
        const dueDateFilters = dateRange('invoice_date_due', input.duePeriod.start, input.duePeriod.end);
        domain = [...domain, ...dueDateFilters];
      }

      if (input.overdueOnly) {
        domain = [...domain, ['invoice_date_due', '<', today]];
      }

      // Total payable
      const totalResult = await odoo.readGroup('account.move', domain, ['amount_residual'], [], { limit: 1 });
      const totalPayable = totalResult[0]?.amount_residual || 0;

      // Total overdue
      const overdueDomain: OdooDomain = [
        ['state', '=', 'posted'],
        ['move_type', '=', 'in_invoice'],
        ['amount_residual', '>', 0],
        ['invoice_date_due', '<', today],
      ];
      const overdueResult = await odoo.readGroup('account.move', overdueDomain, ['amount_residual'], [], { limit: 1 });
      const totalOverdue = overdueResult[0]?.amount_residual || 0;

      // Count bills and suppliers
      const bills = await odoo.searchRead('account.move', domain, {
        fields: ['id', 'partner_id'],
        limit: 10000,
      });

      const billCount = bills.length;
      const uniqueSuppliers = new Set(
        bills.map((b: any) => (Array.isArray(b.partner_id) ? b.partner_id[0] : b.partner_id))
      );
      const supplierCount = uniqueSuppliers.size;

      // Group by supplier if requested
      let bySupplier: SupplierPayable[] | undefined;
      if (input.groupBySupplier) {
        const grouped = await odoo.readGroup(
          'account.move',
          domain,
          ['partner_id', 'amount_residual'],
          ['partner_id'],
          { orderBy: 'amount_residual desc', limit: input.limit }
        );

        bySupplier = grouped.map((g: any) => ({
          supplierId: Array.isArray(g.partner_id) ? g.partner_id[0] : g.partner_id,
          supplierName: Array.isArray(g.partner_id) ? g.partner_id[1] : 'Desconocido',
          amountOwed: g.amount_residual || 0,
          billCount: g.partner_id_count || 1,
        }));
      }

      return success({ totalPayable, totalOverdue, billCount, supplierCount, bySupplier, currency: 'ARS' });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
