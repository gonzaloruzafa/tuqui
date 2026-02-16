/**
 * Skill: get_subscription_detail
 *
 * Full detail of a customer's subscriptions: what products they have,
 * how much they pay, when the next invoice is, contract status.
 * Answers: "What does this customer have contracted?"
 *
 * Odoo 17+: subscriptions live in sale.order with is_subscription=True
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, formatMonto } from './_client';
import { errorToResult } from '../errors';

export const GetSubscriptionDetailInputSchema = z.object({
  /** Customer ID. Obtener de search_customers, NO adivinar. */
  partnerId: z.number().int().positive(),
  /** Include product lines (default: true) */
  includeLines: z.boolean().default(true),
  /** Filter by subscription state */
  subscriptionState: z.enum(['in_progress', 'paused', 'closed', 'churn', 'all']).default('all'),
});

export interface SubscriptionLine {
  productId: number;
  productName: string;
  quantity: number;
  priceUnit: number;
  priceSubtotal: number;
}

export interface SubscriptionRecord {
  id: number;
  name: string;
  state: string;
  stateLabel: string;
  recurringMonthly: number;
  startDate: string;
  nextInvoiceDate: string;
  endDate?: string;
  lines: SubscriptionLine[];
}

export interface SubscriptionDetailOutput {
  customerName: string;
  customerId: number;
  totalMRR: number;
  totalSubscriptions: number;
  subscriptions: SubscriptionRecord[];
}

const STATE_LABELS: Record<string, string> = {
  draft: 'Borrador',
  in_progress: 'Activa',
  paused: 'Pausada',
  closed: 'Cerrada',
  churn: 'Cancelada',
};

export const getSubscriptionDetail: Skill<
  typeof GetSubscriptionDetailInputSchema,
  SubscriptionDetailOutput
> = {
  name: 'get_subscription_detail',

  description: `Detalle completo de las suscripciones de un cliente — productos, precios, próxima factura.
USAR PARA: "qué tiene contratado este cliente", "suscripciones de cliente X",
"productos recurrentes de X", "cuándo le facturamos", "detalle de suscripción",
"qué plan tiene", "qué servicios contrata", "renovación de cliente".
IMPORTANTE: Usar search_customers primero para obtener el partnerId.
Muestra cada suscripción con sus líneas de producto, precio unitario y subtotal.`,

  tool: 'odoo',
  tags: ['subscriptions', 'customer', 'detail', 'lines', 'products'],
  inputSchema: GetSubscriptionDetailInputSchema,

  async execute(input, context): Promise<SkillResult<SubscriptionDetailOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      const domain: any[] = [
        ['is_subscription', '=', true],
        ['partner_id', '=', input.partnerId],
      ];

      if (input.subscriptionState !== 'all') {
        domain.push(['subscription_state', '=', input.subscriptionState]);
      }

      // Get subscriptions
      const subs = await odoo.searchRead<{
        id: number;
        name: string;
        subscription_state: string;
        recurring_monthly: number;
        start_date: string;
        next_invoice_date: string;
        end_date: string | false;
        partner_id: [number, string] | false;
        order_line: number[];
      }>(
        'sale.order',
        domain,
        {
          fields: [
            'name', 'subscription_state', 'recurring_monthly',
            'start_date', 'next_invoice_date', 'end_date', 'partner_id', 'order_line',
          ],
          order: 'subscription_state asc, recurring_monthly desc',
          limit: 50,
        }
      );

      if (subs.length === 0) {
        // Get customer name even if no subs
        const partners = await odoo.searchRead<{ id: number; name: string }>(
          'res.partner',
          [['id', '=', input.partnerId]],
          { fields: ['name'], limit: 1 }
        );
        const _descripcion = `SUSCRIPCIONES de cliente ID ${input.partnerId}: no se encontraron suscripciones para este cliente. IMPORTANTE: es un CLIENTE suscriptor, NO un vendedor.`;

        return success({
          _descripcion,
          customerName: partners[0]?.name || 'Cliente no encontrado',
          customerId: input.partnerId,
          totalMRR: 0,
          totalSubscriptions: 0,
          subscriptions: [],
        });
      }

      const customerName = Array.isArray(subs[0].partner_id) ? subs[0].partner_id[1] : 'Sin nombre';

      // Get lines if requested
      const linesMap = new Map<number, SubscriptionLine[]>();

      if (input.includeLines) {
        const allLineIds = subs.flatMap((s) => s.order_line || []);

        if (allLineIds.length > 0) {
          const lines = await odoo.searchRead<{
            id: number;
            order_id: [number, string];
            product_id: [number, string] | false;
            product_uom_qty: number;
            price_unit: number;
            price_subtotal: number;
          }>(
            'sale.order.line',
            [['id', 'in', allLineIds]],
            {
              fields: ['order_id', 'product_id', 'product_uom_qty', 'price_unit', 'price_subtotal'],
            }
          );

          for (const line of lines) {
            const orderId = Array.isArray(line.order_id) ? line.order_id[0] : line.order_id;
            if (!linesMap.has(orderId)) linesMap.set(orderId, []);
            linesMap.get(orderId)!.push({
              productId: Array.isArray(line.product_id) ? line.product_id[0] : 0,
              productName: Array.isArray(line.product_id) ? line.product_id[1] : 'Sin producto',
              quantity: line.product_uom_qty || 0,
              priceUnit: line.price_unit || 0,
              priceSubtotal: line.price_subtotal || 0,
            });
          }
        }
      }

      let totalMRR = 0;
      const subscriptions: SubscriptionRecord[] = subs.map((s) => {
        if (s.subscription_state === 'in_progress') {
          totalMRR += s.recurring_monthly || 0;
        }
        return {
          id: s.id,
          name: s.name,
          state: s.subscription_state,
          stateLabel: STATE_LABELS[s.subscription_state] || s.subscription_state,
          recurringMonthly: s.recurring_monthly || 0,
          startDate: s.start_date || '',
          nextInvoiceDate: s.next_invoice_date || '',
          endDate: s.end_date || undefined,
          lines: linesMap.get(s.id) || [],
        };
      });

      const _descripcion = `SUSCRIPCIONES de ${customerName} (ID ${input.partnerId}): ${subs.length} suscripciones encontradas, MRR total ${formatMonto(totalMRR)}. Estados: ${subscriptions.map(s => s.stateLabel).join(', ')}. IMPORTANTE: es un CLIENTE suscriptor, NO un vendedor.`;

      return success({
        _descripcion,
        customerName,
        customerId: input.partnerId,
        totalMRR,
        totalSubscriptions: subs.length,
        subscriptions,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
