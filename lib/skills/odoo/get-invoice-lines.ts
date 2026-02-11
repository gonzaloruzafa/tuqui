/**
 * Skill: get_invoice_lines
 *
 * Get individual invoice lines with flexible filtering.
 * This is the most granular invoice skill - returns line-level detail.
 *
 * Use cases:
 * - "Líneas de factura de Maico Moyano"
 * - "Qué productos facturó cada vendedor"
 * - "Detalle de comisiones facturadas"
 * - "Líneas de factura por producto"
 * - "Qué vendió Juan en enero"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetInvoiceLinesInputSchema = z.object({
  /** Time period for analysis */
  period: PeriodSchema.optional(),

  /** Filter by customer ID */
  customerId: z.number().int().optional(),

  /** Filter by customer name (partial match) */
  customerName: z.string().optional(),

  /** Filter by salesperson/seller ID */
  sellerId: z.number().int().optional(),

  /** Filter by salesperson name (partial match) */
  sellerName: z.string().optional(),

  /** Filter by product ID */
  productId: z.number().int().optional(),

  /** Filter by product name (partial match) */
  productName: z.string().optional(),

  /** Filter by invoice state */
  state: z.enum(['all', 'posted', 'draft']).default('posted'),

  /** Only customer invoices (out_invoice) vs vendor bills */
  invoiceType: z.enum(['out_invoice', 'in_invoice', 'all']).default('out_invoice'),

  /** Maximum number of lines to return */
  limit: z.number().int().min(1).max(200).default(50),

  /** Group results by: none (individual lines), product, seller, customer */
  groupBy: z.enum(['none', 'product', 'seller', 'customer']).default('none'),

  /** Company ID. Obtener de get_companies, NO adivinar. */
  companyId: z.number().int().positive().optional(),
});

// ============================================
// OUTPUT TYPES
// ============================================

export interface InvoiceLine {
  lineId: number;
  invoiceId: number;
  invoiceName: string;
  invoiceDate: string;
  customerId: number;
  customerName: string;
  sellerId: number | null;
  sellerName: string | null;
  productId: number | null;
  productName: string;
  quantity: number;
  priceUnit: number;
  subtotal: number;
  discount: number;
}

export interface GroupedInvoiceLines {
  groupId: number | null;
  groupName: string;
  lineCount: number;
  totalQuantity: number;
  totalAmount: number;
  avgPriceUnit: number;
}

export interface InvoiceLinesOutput {
  lines?: InvoiceLine[];
  grouped?: GroupedInvoiceLines[];
  grandTotal: number;
  lineCount: number;
  period: z.infer<typeof PeriodSchema>;
  filters: {
    customer?: string;
    seller?: string;
    product?: string;
  };
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getInvoiceLines: Skill<
  typeof GetInvoiceLinesInputSchema,
  InvoiceLinesOutput
> = {
  name: 'get_invoice_lines',
  description: `Líneas de factura con filtros flexibles. USAR PARA: "qué le vendemos a X cliente", "productos vendidos a X",
"líneas de factura por vendedor", "qué facturó X", "detalle de comisiones", "comisiones por vendedor".
Soporta filtro por compañía (companyId). SIEMPRE llamar get_companies primero para obtener el ID.
Usar groupBy=product + customerName para ver productos vendidos a un cliente específico.`,
  tool: 'odoo',
  tags: ['invoices', 'lines', 'sellers', 'commissions', 'detail'],
  inputSchema: GetInvoiceLinesInputSchema,

  async execute(input, context): Promise<SkillResult<InvoiceLinesOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      // Build base domain for account.move.line
      // We need to join with account.move for date and type filters
      const domain: any[] = [];

      // Date filter on parent invoice
      domain.push(['move_id.invoice_date', '>=', period.start]);
      domain.push(['move_id.invoice_date', '<=', period.end]);

      // Exclude non-product lines (taxes, totals, etc)
      domain.push(['display_type', '=', false]);
      domain.push(['product_id', '!=', false]);

      // State filter on parent invoice
      if (input.state !== 'all') {
        domain.push(['move_id.state', '=', input.state]);
      }

      // Invoice type filter
      if (input.invoiceType !== 'all') {
        domain.push(['move_id.move_type', '=', input.invoiceType]);
      }

      // Customer filter
      if (input.customerId) {
        domain.push(['move_id.partner_id', '=', input.customerId]);
      } else if (input.customerName) {
        domain.push(['move_id.partner_id.name', 'ilike', input.customerName]);
      }

      // Seller filter (invoice_user_id is the salesperson on the invoice)
      if (input.sellerId) {
        domain.push(['move_id.invoice_user_id', '=', input.sellerId]);
      } else if (input.sellerName) {
        domain.push(['move_id.invoice_user_id.name', 'ilike', input.sellerName]);
      }

      // Product filter
      if (input.productId) {
        domain.push(['product_id', '=', input.productId]);
      } else if (input.productName) {
        domain.push(['product_id.name', 'ilike', input.productName]);
      }

      // Company filter
      if (input.companyId) {
        domain.push(['move_id.company_id', '=', input.companyId]);
      }

      const filters: InvoiceLinesOutput['filters'] = {};
      if (input.customerName || input.customerId) filters.customer = input.customerName || `ID:${input.customerId}`;
      if (input.sellerName || input.sellerId) filters.seller = input.sellerName || `ID:${input.sellerId}`;
      if (input.productName || input.productId) filters.product = input.productName || `ID:${input.productId}`;

      // Grouped query
      if (input.groupBy !== 'none') {
        const groupField = {
          'product': 'product_id',
          'seller': 'move_id.invoice_user_id',
          'customer': 'move_id.partner_id',
        }[input.groupBy];

        const grouped = await odoo.readGroup(
          'account.move.line',
          domain,
          [groupField, 'quantity:sum', 'price_subtotal:sum', 'price_unit:avg'],
          [groupField],
          {
            limit: input.limit,
            orderBy: 'price_subtotal desc',
          }
        );

        const results: GroupedInvoiceLines[] = grouped
          .filter((g) => g[groupField])
          .map((g) => {
            const fieldValue = g[groupField];
            const [groupId, groupName] = Array.isArray(fieldValue) 
              ? fieldValue as [number, string]
              : [null, String(fieldValue)];

            return {
              groupId,
              groupName: groupName || 'Sin asignar',
              lineCount: g[`${groupField.replace('.', '_')}_count`] || g.__count || 1,
              totalQuantity: g.quantity || 0,
              totalAmount: g.price_subtotal || 0,
              avgPriceUnit: g.price_unit || 0,
            };
          });

        const grandTotal = results.reduce((sum, r) => sum + r.totalAmount, 0);
        const lineCount = results.reduce((sum, r) => sum + r.lineCount, 0);

        return success({
          grouped: results,
          grandTotal,
          lineCount,
          period,
          filters,
        });
      }

      // Individual lines query
      const lines = await odoo.searchRead(
        'account.move.line',
        domain,
        {
          fields: [
            'id',
            'move_id',
            'product_id',
            'name',
            'quantity',
            'price_unit',
            'price_subtotal',
            'discount',
          ],
          limit: input.limit,
          order: 'price_subtotal desc',
        }
      );

      // Get related invoice data (we need partner, seller, date)
      const moveIds = [...new Set(lines.map((l: any) => {
        const moveId = l.move_id;
        return Array.isArray(moveId) ? moveId[0] : moveId;
      }))];

      const moves = moveIds.length > 0 ? await odoo.searchRead(
        'account.move',
        [['id', 'in', moveIds]],
        { 
          fields: ['id', 'name', 'invoice_date', 'partner_id', 'invoice_user_id'],
          limit: 1000 
        }
      ) : [];

      const moveMap = new Map(moves.map((m: any) => [m.id, m]));

      // Transform results
      const results: InvoiceLine[] = lines.map((line: any) => {
        const moveId = Array.isArray(line.move_id) ? line.move_id[0] : line.move_id;
        const move = moveMap.get(moveId) || {};
        
        const productId = Array.isArray(line.product_id) ? line.product_id[0] : line.product_id;
        const productName = Array.isArray(line.product_id) ? line.product_id[1] : (line.name || 'Sin producto');
        
        const customerId = Array.isArray(move.partner_id) ? move.partner_id[0] : move.partner_id;
        const customerName = Array.isArray(move.partner_id) ? move.partner_id[1] : 'Sin cliente';
        
        const sellerId = Array.isArray(move.invoice_user_id) ? move.invoice_user_id[0] : move.invoice_user_id;
        const sellerName = Array.isArray(move.invoice_user_id) ? move.invoice_user_id[1] : null;

        return {
          lineId: line.id,
          invoiceId: moveId,
          invoiceName: Array.isArray(line.move_id) ? line.move_id[1] : `INV-${moveId}`,
          invoiceDate: move.invoice_date || '',
          customerId: customerId || 0,
          customerName: customerName || 'Sin cliente',
          sellerId: sellerId || null,
          sellerName: sellerName || null,
          productId: productId || null,
          productName,
          quantity: line.quantity || 0,
          priceUnit: line.price_unit || 0,
          subtotal: line.price_subtotal || 0,
          discount: line.discount || 0,
        };
      });

      const grandTotal = results.reduce((sum, l) => sum + l.subtotal, 0);

      return success({
        lines: results,
        grandTotal,
        lineCount: results.length,
        period,
        filters,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
