/**
 * Skill: get_expiring_stock
 *
 * Retrieves products approaching expiration date using stock.lot (Odoo 14+)
 * cross-referenced with stock.quant for real stock levels.
 *
 * Two-step query:
 * 1. stock.lot → find lots with expiration_date in range
 * 2. stock.quant → filter only lots with actual stock > 0
 *
 * @example
 * User: "¿Qué productos se vencen esta semana?"
 * User: "Mercadería próxima a vencer"
 * User: "Vencimientos de los próximos 15 días"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetExpiringStockInputSchema = z.object({
  /** Days ahead to check for expiration (default 30, max 180) */
  days_ahead: z.number().int().min(1).max(180).default(30),

  /** Include already expired products that still have stock */
  include_expired: z.boolean().default(false),

  /** Search by product name (partial match) */
  product_search: z.string().min(1).optional(),

  /** Filter by warehouse/location ID */
  warehouse_id: z.number().positive().optional(),

  /** Maximum items to return */
  limit: z.number().int().min(1).max(100).default(30),
});

export type GetExpiringStockInput = z.infer<typeof GetExpiringStockInputSchema>;

// ============================================
// OUTPUT TYPES
// ============================================

export interface ExpiringProduct {
  lotId: number;
  lotName: string;
  productId: number;
  productName: string;
  expirationDate: string;
  daysUntilExpiry: number;
  quantity: number;
  locationName?: string;
}

export interface ExpirationBucket {
  label: string;
  count: number;
  totalQuantity: number;
}

export interface GetExpiringStockOutput {
  products: ExpiringProduct[];
  summary: {
    totalProducts: number;
    totalQuantity: number;
    buckets: ExpirationBucket[];
  };
}

// ============================================
// HELPERS
// ============================================

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function daysBetween(dateStr: string, today: Date): number {
  // Normalize both to UTC date-only to avoid timezone drift
  const target = new Date(dateStr.slice(0, 10) + 'T00:00:00Z');
  const todayUtc = new Date(today.toISOString().slice(0, 10) + 'T00:00:00Z');
  const diffMs = target.getTime() - todayUtc.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function buildBuckets(products: ExpiringProduct[]): ExpirationBucket[] {
  const buckets: Record<string, ExpirationBucket> = {
    expired: { label: '🔴 Vencidos', count: 0, totalQuantity: 0 },
    critical: { label: '🟠 Crítico (0-7 días)', count: 0, totalQuantity: 0 },
    soon: { label: '🟡 Próximo (8-30 días)', count: 0, totalQuantity: 0 },
    later: { label: '🟢 Futuro (31+ días)', count: 0, totalQuantity: 0 },
  };

  for (const p of products) {
    const key =
      p.daysUntilExpiry < 0 ? 'expired' :
      p.daysUntilExpiry <= 7 ? 'critical' :
      p.daysUntilExpiry <= 30 ? 'soon' : 'later';

    buckets[key].count++;
    buckets[key].totalQuantity += p.quantity;
  }

  return Object.values(buckets).filter(b => b.count > 0);
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getExpiringStock: Skill<
  typeof GetExpiringStockInputSchema,
  GetExpiringStockOutput
> = {
  name: 'get_expiring_stock',

  description: `Productos próximos a vencer y control de vencimientos de mercadería.
USAR PARA: "qué se vence", "productos por vencer", "vencimientos", "mercadería a punto de vencer",
"rotación de stock", "fecha de vencimiento", "lotes por vencer", "expiring", "productos vencidos",
"stock expirado", "qué hay que mover", "vence esta semana", "vence este mes".
PARÁMETROS: days_ahead (1-180, default 30), include_expired (bool), product_search (texto).
RETORNA: lista de productos con lote, fecha de vencimiento, cantidad y días restantes,
más resumen por urgencia (vencidos, crítico 0-7d, próximo 8-30d, futuro 31+d).
Los resultados se ordenan por fecha de vencimiento ASC (más urgente primero).`,

  tool: 'odoo',
  tags: ['stock', 'expiration', 'inventory', 'lots'],
  inputSchema: GetExpiringStockInputSchema,
  priority: 15,

  async execute(
    input: GetExpiringStockInput,
    context: SkillContext
  ): Promise<SkillResult<GetExpiringStockOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const today = new Date();
      const todayStr = formatDate(today);
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + input.days_ahead);
      const futureDateStr = formatDate(futureDate);

      // ─── Step 1: Find lots with expiration in range ───
      const lotDomain: OdooDomain = [];

      if (input.include_expired) {
        // Expired OR expiring within range
        lotDomain.push('|');
        lotDomain.push(['expiration_date', '<', todayStr]);
        lotDomain.push('&');
        lotDomain.push(['expiration_date', '>=', todayStr]);
        lotDomain.push(['expiration_date', '<=', futureDateStr]);
      } else {
        // Only expiring within range (not yet expired)
        lotDomain.push(['expiration_date', '>=', todayStr]);
        lotDomain.push(['expiration_date', '<=', futureDateStr]);
      }

      // Filter by product name if specified
      if (input.product_search) {
        lotDomain.push(['product_id.name', 'ilike', input.product_search]);
      }

      const lots = await odoo.searchRead<{
        id: number;
        name: string;
        product_id: [number, string];
        expiration_date: string;
      }>(
        'stock.lot',
        lotDomain,
        {
          fields: ['name', 'product_id', 'expiration_date'],
          order: 'expiration_date asc',
          limit: 2000,
        }
      );

      if (lots.length === 0) {
        const _descripcion = 'No se encontraron productos con vencimiento en el rango solicitado.';
        return success({
          _descripcion,
          products: [],
          summary: { totalProducts: 0, totalQuantity: 0, buckets: [] },
        });
      }

      // ─── Step 2: Check real stock for those lots ───
      const lotIds = lots.map(l => l.id);
      const quantDomain: OdooDomain = [
        ['lot_id', 'in', lotIds],
        ['quantity', '>', 0],
        ['location_id.usage', '=', 'internal'],
      ];

      if (input.warehouse_id) {
        quantDomain.push(['location_id', 'child_of', input.warehouse_id]);
      }

      const quants = await odoo.searchRead<{
        lot_id: [number, string];
        product_id: [number, string];
        quantity: number;
        location_id: [number, string];
      }>(
        'stock.quant',
        quantDomain,
        {
          fields: ['lot_id', 'product_id', 'quantity', 'location_id'],
          limit: 2000,
        }
      );

      // Aggregate quantity per lot
      const stockByLot = new Map<number, { quantity: number; locationName?: string }>();
      for (const q of quants) {
        const lotId = q.lot_id[0];
        const existing = stockByLot.get(lotId);
        if (existing) {
          existing.quantity += q.quantity;
        } else {
          stockByLot.set(lotId, {
            quantity: q.quantity,
            locationName: q.location_id?.[1],
          });
        }
      }

      // ─── Merge lots + stock, filter to lots with stock ───
      const products: ExpiringProduct[] = lots
        .filter(lot => stockByLot.has(lot.id))
        .map(lot => {
          const stock = stockByLot.get(lot.id)!;
          return {
            lotId: lot.id,
            lotName: lot.name,
            productId: lot.product_id[0],
            productName: lot.product_id[1],
            expirationDate: lot.expiration_date,
            daysUntilExpiry: daysBetween(lot.expiration_date, today),
            quantity: stock.quantity,
            locationName: stock.locationName,
          };
        })
        .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
        .slice(0, input.limit);

      const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
      const buckets = buildBuckets(products);

      const _descripcion = `Productos con vencimiento próximo: ${products.length} producto(s), ${totalQuantity} unidades totales en stock. Rango: próximos ${input.days_ahead} días${input.include_expired ? ' (incluye vencidos)' : ''}. Distribución: ${buckets.map(b => `${b.label}: ${b.count}`).join(', ')}. IMPORTANTE: son PRODUCTOS del inventario con fecha de vencimiento, NO son clientes.`;

      return success({
        _descripcion,
        products,
        summary: {
          totalProducts: products.length,
          totalQuantity,
          buckets,
        },
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
