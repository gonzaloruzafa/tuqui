/**
 * Skill: get_invoices_by_customer
 *
 * Get invoices grouped by customer.
 *
 * Use cases:
 * - "¿Cuánto facturé a cada cliente?"
 * - "Top clientes por facturación"
 * - "Facturas por cliente este mes"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod, formatMonto } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetInvoicesByCustomerInputSchema = z.object({
  /** Time period for analysis */
  period: PeriodSchema.optional(),

  /** Maximum number of customers to return */
  limit: z.number().int().min(1).max(100).default(10),

  /** Filter by invoice state */
  state: z.enum(['all', 'posted', 'draft']).default('posted'),

  /** Only customer invoices (out_invoice) vs vendor bills */
  invoiceType: z.enum(['out_invoice', 'in_invoice', 'all']).default('out_invoice'),

  /** Filter by customer name (partial match). Use for: "facturas de Cliente X", "cuánto facturamos a X" */
  customerName: z.string().optional(),

  /** Filter by salesperson name on the invoice (partial match) */
  sellerName: z.string().optional(),

  /** Company ID. Obtener de get_companies, NO adivinar. */
  companyId: z.number().int().positive().optional(),
});

// ============================================
// OUTPUT TYPE
// ============================================

export interface CustomerInvoices {
  customerId: number;
  customerName: string;
  invoiceCount: number;
  totalAmount: number;
  avgInvoiceAmount: number;
}

export interface InvoicesByCustomerOutput {
  customers: CustomerInvoices[];
  grandTotal: number;
  totalInvoices: number;
  customerCount: number;
  period: z.infer<typeof PeriodSchema>;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getInvoicesByCustomer: Skill<
  typeof GetInvoicesByCustomerInputSchema,
  InvoicesByCustomerOutput
> = {
  name: 'get_invoices_by_customer',
  description: `Facturas agrupadas por cliente. Puede filtrar por UN cliente específico con customerName o por vendedor con sellerName.
USAR PARA: "facturas de Cliente X", "cuánto facturamos a X", "facturación por cliente", "top clientes facturados",
"facturas del vendedor X", "cuánto facturó cada vendedor".
Soporta filtro por compañía (companyId). SIEMPRE llamar get_companies primero para obtener el ID.
Ejemplo: customerName="Acme Corp" devuelve solo facturas de ese cliente.`,
  tool: 'odoo',
  tags: ['invoices', 'customers', 'accounting'],
  inputSchema: GetInvoicesByCustomerInputSchema,

  async execute(input, context): Promise<SkillResult<InvoicesByCustomerOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      // Build domain
      const domain = combineDomains(
        dateRange('invoice_date', period.start, period.end)
      );

      // State filter
      if (input.state !== 'all') {
        domain.push(['state', '=', input.state]);
      }

      // Invoice type filter
      if (input.invoiceType !== 'all') {
        domain.push(['move_type', '=', input.invoiceType]);
      }

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

      // Group by partner
      const grouped = await odoo.readGroup(
        'account.move',
        domain,
        ['partner_id', 'amount_total:sum'],
        ['partner_id'],
        {
          limit: input.limit,
          orderBy: 'amount_total desc',
        }
      );

      // Transform results
      const customers: CustomerInvoices[] = grouped
        .filter((g) => g.partner_id && Array.isArray(g.partner_id))
        .map((g) => {
          const [customerId, customerName] = g.partner_id as [number, string];
          const totalAmount = g.amount_total || 0;
          const invoiceCount = g.partner_id_count || 1;

          return {
            customerId,
            customerName,
            invoiceCount,
            totalAmount,
            avgInvoiceAmount: totalAmount / invoiceCount,
          };
        });

      // Calculate totals
      const grandTotal = customers.reduce((sum, c) => sum + c.totalAmount, 0);
      const totalInvoices = customers.reduce((sum, c) => sum + c.invoiceCount, 0);

      const _top = customers[0];
      const _descripcion = `Facturas emitidas por CLIENTE. ${customers.length} clientes.${_top ? ` Top: ${_top.customerName} con ${formatMonto(_top.totalAmount)}.` : ''} Total facturado: ${formatMonto(grandTotal)}. IMPORTANTE: estos son CLIENTES a quienes se facturó, NO son vendedores.`;

      return success({
        _descripcion,
        customers,
        grandTotal,
        totalInvoices,
        customerCount: customers.length,
        period,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
