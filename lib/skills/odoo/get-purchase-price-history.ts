/**
 * Skill: get_purchase_price_history
 *
 * Purchase price history for a product - compare suppliers, detect trends.
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange } from './_client';
import { errorToResult } from '../errors';

export const GetPurchasePriceHistoryInputSchema = z.object({
  productQuery: z.string().min(1).describe('Product name or partial name to search'),
  period: PeriodSchema.optional(),
  groupBySupplier: z.boolean().default(true),
  limit: z.number().int().min(1).max(50).default(20),
});

export interface PurchaseHistoryEntry {
  orderId: number;
  orderName: string;
  supplierId: number;
  supplierName: string;
  priceUnit: number;
  quantity: number;
  subtotal: number;
  dateOrder: string;
}

export interface SupplierPriceSummary {
  supplierId: number;
  supplierName: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  lastPrice: number;
  totalQty: number;
  orderCount: number;
}

export interface PriceChange {
  firstPrice: number;
  lastPrice: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface PurchasePriceHistoryOutput {
  productId: number;
  productName: string;
  history: PurchaseHistoryEntry[];
  bySupplier?: SupplierPriceSummary[];
  priceChange?: PriceChange;
}

export const getPurchasePriceHistory: Skill<
  typeof GetPurchasePriceHistoryInputSchema,
  PurchasePriceHistoryOutput
> = {
  name: 'get_purchase_price_history',

  description: `Historial de precios de compra de un producto - comparar proveedores, detectar tendencias.
USAR PARA: "a cuánto compramos X", "historial de precios de compra", "qué proveedor es más barato",
"comparar proveedores", "¿subió el precio de X?", "evolución del precio de compra",
"mejor precio de compra", "a cuánto nos venden X".
Busca el producto por nombre, muestra las purchase.order.line y agrupa por proveedor.`,

  tool: 'odoo',
  tags: ['purchases', 'prices', 'suppliers', 'comparison', 'reporting'],
  inputSchema: GetPurchasePriceHistoryInputSchema,

  async execute(input, context): Promise<SkillResult<PurchasePriceHistoryOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      // Find product by name
      const products = await odoo.searchRead<{ id: number; name: string }>(
        'product.product',
        [['name', 'ilike', input.productQuery]],
        { fields: ['id', 'name'], limit: 1 }
      );

      if (products.length === 0) {
        return success({
          productId: 0,
          productName: input.productQuery,
          history: [],
        });
      }

      const product = products[0];

      // Get purchase order lines for this product
      const polDomain: any[] = [
        ['product_id', '=', product.id],
        ['order_id.state', 'in', ['purchase', 'done']],
      ];

      if (input.period) {
        polDomain.push(...dateRange('date_order', input.period.start, input.period.end));
      }

      const lines = await odoo.searchRead<{
        id: number;
        product_id: [number, string];
        order_id: [number, string];
        partner_id: [number, string];
        price_unit: number;
        product_qty: number;
        price_subtotal: number;
        date_order: string;
      }>(
        'purchase.order.line',
        polDomain,
        {
          fields: ['product_id', 'order_id', 'partner_id', 'price_unit', 'product_qty', 'price_subtotal', 'date_order'],
          limit: input.limit,
          order: 'date_order desc',
        }
      );

      const history: PurchaseHistoryEntry[] = lines.map((l) => ({
        orderId: Array.isArray(l.order_id) ? l.order_id[0] : l.order_id,
        orderName: Array.isArray(l.order_id) ? l.order_id[1] : '',
        supplierId: Array.isArray(l.partner_id) ? l.partner_id[0] : l.partner_id,
        supplierName: Array.isArray(l.partner_id) ? l.partner_id[1] : '',
        priceUnit: l.price_unit,
        quantity: l.product_qty,
        subtotal: l.price_subtotal,
        dateOrder: l.date_order,
      }));

      let bySupplier: SupplierPriceSummary[] | undefined;
      let priceChange: PriceChange | undefined;

      if (input.groupBySupplier !== false && history.length > 0) {
        // Group by supplier
        const supplierMap = new Map<number, { name: string; prices: number[]; qty: number; count: number }>();

        for (const entry of history) {
          const existing = supplierMap.get(entry.supplierId);
          if (existing) {
            existing.prices.push(entry.priceUnit);
            existing.qty += entry.quantity;
            existing.count++;
          } else {
            supplierMap.set(entry.supplierId, {
              name: entry.supplierName,
              prices: [entry.priceUnit],
              qty: entry.quantity,
              count: 1,
            });
          }
        }

        bySupplier = Array.from(supplierMap.entries()).map(([id, data]) => ({
          supplierId: id,
          supplierName: data.name,
          avgPrice: Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length),
          minPrice: Math.min(...data.prices),
          maxPrice: Math.max(...data.prices),
          lastPrice: data.prices[0], // history is sorted desc
          totalQty: data.qty,
          orderCount: data.count,
        }));

        // Sort by avg price ascending (cheapest first)
        bySupplier.sort((a, b) => a.avgPrice - b.avgPrice);
      }

      // Price trend (oldest vs newest)
      if (history.length >= 2) {
        const firstPrice = history[history.length - 1].priceUnit;
        const lastPrice = history[0].priceUnit;
        const changePercent = firstPrice > 0 ? Math.round(((lastPrice - firstPrice) / firstPrice) * 100) : 0;

        priceChange = {
          firstPrice,
          lastPrice,
          changePercent,
          trend: changePercent > 2 ? 'up' : changePercent < -2 ? 'down' : 'stable',
        };
      }

      return success({
        productId: product.id,
        productName: product.name,
        history,
        bySupplier,
        priceChange,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
