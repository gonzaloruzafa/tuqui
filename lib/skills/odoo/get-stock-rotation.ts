/**
 * Skill: get_stock_rotation
 *
 * Cross-references current stock (stock.quant) with sales (sale.order.line)
 * to identify products with high stock and low/no sales — candidates for
 * liquidation or promotional campaigns.
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError, PeriodSchema } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

export const GetStockRotationInputSchema = z.object({
  period: PeriodSchema.optional().describe('Período de ventas a analizar (default: últimos 12 meses)'),
  limit: z.number().int().min(1).max(50).default(20),
  /** Only show products with zero sales in the period */
  zeroSalesOnly: z.boolean().default(false),
  /** Filter by product template ID to check rotation of a specific product (all variants) */
  productTemplateId: z.number().int().positive().optional(),
});

export interface StockRotationProduct {
  productId: number;
  productName: string;
  /** Current stock quantity */
  stockQuantity: number;
  /** Unit of measure */
  uom: string;
  /** Units sold in the period */
  quantitySold: number;
  /** Revenue in the period */
  revenue: number;
  /** Number of sale orders */
  orderCount: number;
  /** Estimated stock value (qty × standard_price) */
  stockValue: number;
}

export interface StockRotationOutput {
  products: StockRotationProduct[];
  period: { start: string; end: string; label?: string };
  totalStockValue: number;
}

export const getStockRotation: Skill<
  typeof GetStockRotationInputSchema,
  StockRotationOutput
> = {
  name: 'get_stock_rotation',
  description: `Analiza rotación de stock: cruza inventario actual con ventas del período.
USAR CUANDO: "productos estancados", "stock sin movimiento", "qué no se vende",
"rotación de inventario", "productos parados", "stock dormido", "liquidación".
Soporta productTemplateId para analizar un producto específico (todas las variantes).
Devuelve productos con alto stock y pocas/ninguna venta, ordenados por valor parado.`,
  tool: 'odoo',
  tags: ['inventory', 'stock', 'sales', 'rotation', 'analysis'],
  inputSchema: GetStockRotationInputSchema,

  async execute(input, context): Promise<SkillResult<StockRotationOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      // Step 1: Get top stocked products (internal locations only)
      const stockDomain: OdooDomain = [
        ['quantity', '>', 0],
        ['location_id.usage', '=', 'internal'],
      ];

      // Filter by product template if specified
      if (input.productTemplateId) {
        const variants = await odoo.searchRead<{ id: number }>(
          'product.product',
          [['product_tmpl_id', '=', input.productTemplateId]],
          { fields: ['id'] }
        );
        const variantIds = variants.map(v => v.id);
        if (variantIds.length === 0) {
          return success({ products: [], period, totalStockValue: 0 });
        }
        stockDomain.push(['product_id', 'in', variantIds]);
      }

      const stockData = await odoo.readGroup(
        'stock.quant',
        stockDomain,
        ['product_id', 'quantity:sum'],
        ['product_id'],
        { limit: 100, orderBy: 'quantity desc' }
      );

      if (stockData.length === 0) {
        return success({ products: [], period, totalStockValue: 0 });
      }

      const productIds = stockData
        .map((row: any) => row.product_id?.[0])
        .filter(Boolean);

      // Step 2: Get product details (UoM + cost) in one call
      const productDetails = await odoo.searchRead<{
        id: number;
        uom_id: [number, string];
        standard_price: number;
      }>(
        'product.product',
        [['id', 'in', productIds]],
        { fields: ['id', 'uom_id', 'standard_price'] }
      );

      const productMap = new Map(
        productDetails.map(p => [p.id, {
          uom: p.uom_id?.[1] || 'Unidad',
          cost: p.standard_price || 0,
        }])
      );

      // Step 3: Get sales for those products in the period
      const salesDomain = combineDomains(
        dateRange('order_id.date_order', period.start, period.end),
        [
          ['product_id', 'in', productIds],
          ['order_id.state', 'in', ['sale', 'done']],
        ]
      );

      const salesData = await odoo.readGroup(
        'sale.order.line',
        salesDomain,
        ['product_id', 'product_uom_qty:sum', 'price_total:sum', '__count'],
        ['product_id'],
        {}
      );

      const salesMap = new Map(
        salesData.map((row: any) => [
          row.product_id?.[0],
          {
            quantity: row.product_uom_qty || 0,
            revenue: row.price_total || 0,
            count: row.__count || 0,
          },
        ])
      );

      // Step 4: Combine and sort by stock value (highest $ parado first)
      const products: StockRotationProduct[] = stockData
        .map((row: any) => {
          const id = row.product_id?.[0] || 0;
          const details = productMap.get(id);
          const sales = salesMap.get(id);
          const stockQty = row.quantity || 0;

          return {
            productId: id,
            productName: row.product_id?.[1] || 'Sin nombre',
            stockQuantity: stockQty,
            uom: details?.uom || 'Unidad',
            quantitySold: sales?.quantity || 0,
            revenue: sales?.revenue || 0,
            orderCount: sales?.count || 0,
            stockValue: stockQty * (details?.cost || 0),
          };
        })
        .filter((p: StockRotationProduct) =>
          input.zeroSalesOnly ? p.orderCount === 0 : true
        )
        .sort((a: StockRotationProduct, b: StockRotationProduct) =>
          // Products with fewer sales and higher stock value first
          (a.orderCount - b.orderCount) || (b.stockValue - a.stockValue)
        )
        .slice(0, input.limit);

      const totalStockValue = products.reduce((sum, p) => sum + p.stockValue, 0);

      return success({ products, period, totalStockValue });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
