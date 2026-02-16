/**
 * Skill: get_purchases_by_supplier
 *
 * Get purchases grouped by supplier.
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod, formatMonto } from './_client';
import { errorToResult } from '../errors';

export const GetPurchasesBySupplierInputSchema = z.object({
  period: PeriodSchema.optional(),
  limit: z.number().int().min(1).max(100).default(10),
  state: z.enum(['all', 'confirmed', 'draft']).default('confirmed'),
});

export interface SupplierPurchases {
  supplierId: number;
  supplierName: string;
  orderCount: number;
  /** Total with taxes */
  totalAmountWithTax: number;
  /** Total without taxes */
  totalAmountWithoutTax: number;
}

export interface PurchasesBySupplierOutput {
  suppliers: SupplierPurchases[];
  grandTotalWithTax: number;
  grandTotalWithoutTax: number;
  totalOrders: number;
  period: z.infer<typeof PeriodSchema>;
}

export const getPurchasesBySupplier: Skill<
  typeof GetPurchasesBySupplierInputSchema,
  PurchasesBySupplierOutput
> = {
  name: 'get_purchases_by_supplier',
  description: `Compras agrupadas por proveedor. EJECUTAR SIN PREGUNTAR PERÍODO (usa mes actual).
Para: "a quién le compramos más", "cuánto le compramos a cada proveedor", "principal proveedor",
"top suppliers", "compras por proveedor", "supplier spending".`,
  tool: 'odoo',
  tags: ['purchases', 'suppliers', 'reporting'],
  inputSchema: GetPurchasesBySupplierInputSchema,

  async execute(input, context): Promise<SkillResult<PurchasesBySupplierOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      const domain = combineDomains(
        dateRange('date_order', period.start, period.end)
      );

      if (input.state !== 'all') {
        if (input.state === 'confirmed') {
          domain.push(['state', 'in', ['purchase', 'done']]);
        } else {
          domain.push(['state', '=', input.state]);
        }
      }

      const grouped = await odoo.readGroup(
        'purchase.order',
        domain,
        ['partner_id', 'amount_total:sum', 'amount_untaxed:sum'],
        ['partner_id'],
        { limit: input.limit, orderBy: 'amount_total desc' }
      );

      const suppliers: SupplierPurchases[] = grouped
        .filter((g) => g.partner_id && Array.isArray(g.partner_id))
        .map((g) => ({
          supplierId: (g.partner_id as [number, string])[0],
          supplierName: (g.partner_id as [number, string])[1],
          orderCount: g.partner_id_count || 1,
          totalAmountWithTax: g.amount_total || 0,
          totalAmountWithoutTax: g.amount_untaxed || 0,
        }));

      const grandTotalWithTax = suppliers.reduce((sum, s) => sum + s.totalAmountWithTax, 0);
      const grandTotalWithoutTax = suppliers.reduce((sum, s) => sum + s.totalAmountWithoutTax, 0);
      const totalOrders = suppliers.reduce((sum, s) => sum + s.orderCount, 0);

      const _descripcion = `Compras agrupadas por proveedor (${period.start} a ${period.end}): ${suppliers.length} proveedores, ${totalOrders} órdenes, total con impuestos ${formatMonto(grandTotalWithTax)}, sin impuestos ${formatMonto(grandTotalWithoutTax)}. Top proveedor: ${suppliers[0]?.supplierName || 'N/A'} (${suppliers[0] ? formatMonto(suppliers[0].totalAmountWithTax) : '$0'}). IMPORTANTE: estos son PROVEEDORES a quienes les compramos, NO son clientes ni vendedores del equipo.`;

      return success({
        _descripcion,
        suppliers,
        grandTotalWithTax,
        grandTotalWithoutTax,
        totalOrders,
        period,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
