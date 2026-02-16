/**
 * Skill: get_debt_by_customer
 *
 * Retrieves outstanding debt grouped by customer.
 * Replaces the LLM-generated query for "who owes us", "customer debt", etc.
 *
 * @example
 * User: "¿Quién nos debe plata?"
 * User: "Deudas de clientes"
 * User: "Cuentas por cobrar por cliente"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError } from '../types';
import {
  createOdooClient,
  combineDomains,
  invoiceTypeFilter,
  formatMonto,
  type OdooDomain,
  type DomainFilter,
} from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetDebtByCustomerInputSchema = z.object({
  /** Maximum number of customers to return */
  limit: z.number().min(1).max(100).default(20),
  /** Minimum debt amount to include */
  minAmount: z.number().min(0).default(0),
  /** Include overdue days calculation */
  includeOverdueDays: z.boolean().default(true),
  /** Only show invoices overdue by this many days */
  minOverdueDays: z.number().min(0).optional(),
  /** Filter by customer name (partial match). Use for: "deuda de Cliente X", "cuánto debe X" */
  customerName: z.string().optional(),
  /** Filter by salesperson name on the invoice (partial match). Use for: "deuda por vendedor X" */
  sellerName: z.string().optional(),
  /** Company ID. Obtener de get_companies, NO adivinar. */
  companyId: z.number().int().positive().optional(),
});

export type GetDebtByCustomerInput = z.infer<typeof GetDebtByCustomerInputSchema>;

// ============================================
// OUTPUT TYPES
// ============================================

export interface CustomerDebt {
  /** Odoo partner ID */
  customerId: number;
  /** Customer display name */
  customerName: string;
  /** Total outstanding debt */
  totalDebt: number;
  /** Number of unpaid invoices */
  invoiceCount: number;
  /** Oldest invoice date */
  oldestInvoiceDate?: string;
  /** Days since oldest invoice */
  maxOverdueDays?: number;
}

export interface GetDebtByCustomerOutput {
  /** List of customers with their debt */
  customers: CustomerDebt[];
  /** Sum of all customer debts */
  grandTotal: number;
  /** Total number of unpaid invoices */
  totalInvoices: number;
  /** Number of customers with debt */
  customerCount: number;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getDebtByCustomer: Skill<
  typeof GetDebtByCustomerInputSchema,
  GetDebtByCustomerOutput
> = {
  name: 'get_debt_by_customer',

  description: `Deudas de clientes - quién nos debe más y cuánto. HERRAMIENTA PRINCIPAL para cobranzas.
Use for: "quién nos debe más", "clientes morosos", "deudores principales", "accounts receivable", 
"deudas de clientes", "quién nos debe", "cuentas por cobrar", "saldos pendientes",
"top deudores", "clientes con deuda", "cobrar", "deuda por vendedor/comercial".
Puede filtrar por UN cliente con customerName, por vendedor con sellerName.
Soporta filtro por compañía (companyId). SIEMPRE llamar get_companies primero para obtener el ID.
Devuelve cliente, monto adeudado, fecha vencimiento.`,

  tool: 'odoo',

  inputSchema: GetDebtByCustomerInputSchema,

  tags: ['invoices', 'debt', 'customers', 'accounts-receivable'],

  priority: 12,

  async execute(
    input: GetDebtByCustomerInput,
    context: SkillContext
  ): Promise<SkillResult<GetDebtByCustomerOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      // Build domain for unpaid customer invoices
      const baseDomain: DomainFilter[] = [
        ['state', '=', 'posted'],
        ['amount_residual', '>', 0],
      ];

      const domain: OdooDomain = combineDomains(
        baseDomain,
        invoiceTypeFilter('out_invoice') // Customer invoices only
      );

      // Filter by customer name (partial match via ilike)
      if (input.customerName) {
        domain.push(['partner_id.name', 'ilike', input.customerName]);
      }

      // Filter by salesperson (invoice_user_id)
      if (input.sellerName) {
        domain.push(['invoice_user_id.name', 'ilike', input.sellerName]);
      }

      // Filter by company
      if (input.companyId) {
        domain.push(['company_id', '=', input.companyId]);
      }

      // Get aggregated debt by customer
      const grouped = await odoo.readGroup(
        'account.move',
        domain,
        ['partner_id', 'amount_residual:sum', 'invoice_date:min'],
        ['partner_id'],
        {
          limit: input.limit * 2, // Extra for filtering
          orderBy: 'amount_residual desc',
        }
      );

      // Transform results
      const today = new Date();
      let customers: CustomerDebt[] = grouped
        .filter((g) => g.partner_id)
        .map((g) => {
          const oldestDate = g.invoice_date;
          let maxOverdueDays: number | undefined;

          if (input.includeOverdueDays && oldestDate) {
            const invoiceDate = new Date(oldestDate);
            maxOverdueDays = Math.floor(
              (today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
            );
          }

          return {
            customerId: g.partner_id[0],
            customerName: g.partner_id[1],
            totalDebt: g.amount_residual || 0,
            invoiceCount: g.partner_id_count || g.__count || 1,
            oldestInvoiceDate: oldestDate,
            maxOverdueDays,
          };
        });

      // Filter by minimum amount
      if (input.minAmount > 0) {
        customers = customers.filter((c) => c.totalDebt >= input.minAmount);
      }

      // Filter by minimum overdue days
      if (input.minOverdueDays !== undefined) {
        customers = customers.filter(
          (c) => c.maxOverdueDays !== undefined && c.maxOverdueDays >= input.minOverdueDays!
        );
      }

      // Apply final limit
      customers = customers.slice(0, input.limit);

      // Calculate totals
      const grandTotal = customers.reduce((sum, c) => sum + c.totalDebt, 0);
      const totalInvoices = customers.reduce((sum, c) => sum + c.invoiceCount, 0);

      const _top = customers[0];
      const _descripcion = `Deuda pendiente por CLIENTE. ${customers.length} clientes con deuda.${_top ? ` Mayor deudor: ${_top.customerName} con ${formatMonto(_top.totalDebt)}.` : ''} Total: ${formatMonto(grandTotal)}. IMPORTANTE: estos son CLIENTES que le deben plata a la empresa, NO son vendedores ni empleados.`;

      return success({
        _descripcion,
        customers,
        grandTotal,
        totalInvoices,
        customerCount: customers.length,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
