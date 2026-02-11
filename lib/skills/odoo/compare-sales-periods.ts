/**
 * Skill: compare_sales_periods
 *
 * Compares sales between two periods (e.g., today vs yesterday, this month vs last month).
 * Answers "¿Cómo vamos comparado con...?" type questions.
 *
 * @example
 * User: "Ventas hoy vs ayer"
 * User: "Comparar este mes con el mes pasado"
 * User: "¿Cómo vienen las ventas respecto al año pasado?"
 */

import { z } from 'zod'
import type { Skill, SkillContext, SkillResult, Period } from '../types'
import { PeriodSchema, DocumentStateSchema, success, authError } from '../types'
import { createOdooClient, dateRange, stateFilter, combineDomains, getDefaultPeriod, getPreviousMonthPeriod, type OdooDomain, type DomainFilter } from './_client'
import { errorToResult } from '../errors'

// ============================================
// INPUT SCHEMA
// ============================================

export const CompareSalesPeriodsInputSchema = z.object({
  /** Current period to analyze (defaults to this month) */
  currentPeriod: PeriodSchema.optional(),
  /** Previous period to compare against (defaults to last month) */
  previousPeriod: PeriodSchema.optional(),
  /** Filter by order state */
  state: DocumentStateSchema.default('confirmed'),
  /** Include breakdown by product */
  includeProducts: z.boolean().default(false),
  /** Include breakdown by customer */
  includeCustomers: z.boolean().default(false),
  /** Limit for breakdowns */
  limit: z.number().min(1).max(20).default(5),
  /** Filter by sales team ID (e.g., ecommerce, tienda web) */
  teamId: z.number().int().positive().optional(),
})

export type CompareSalesPeriodsInput = z.infer<typeof CompareSalesPeriodsInputSchema>

// ============================================
// OUTPUT TYPES
// ============================================

export interface PeriodSummary {
  /** Total sales with taxes */
  totalSalesWithTax: number
  /** Total sales without taxes */
  totalSalesWithoutTax: number
  /** Number of orders */
  orderCount: number
  /** Number of unique customers */
  customerCount: number
  /** Average order value (with tax) */
  avgOrderValueWithTax: number
  /** Average order value (without tax) */
  avgOrderValueWithoutTax: number
  /** Period description */
  periodLabel: string
}

export interface ComparisonItem {
  /** Item ID (product or customer) */
  id: number
  /** Item name */
  name: string
  /** Sales in current period */
  currentSales: number
  /** Sales in previous period */
  previousSales: number
  /** Absolute change */
  change: number
  /** Percentage change */
  changePercent: number | null
}

export interface CompareSalesPeriodsOutput {
  /** Current period summary */
  current: PeriodSummary
  /** Previous period summary */
  previous: PeriodSummary
  /** Absolute change in sales (with tax) */
  salesChange: number
  /** Percentage change in sales (with tax) */
  salesChangePercent: number | null
  /** Change in order count */
  orderCountChange: number
  /** Change in average order value (with tax) */
  avgOrderValueChange: number
  /** Trend direction */
  trend: 'up' | 'down' | 'stable'
  /** Product comparison (if requested) */
  productComparison?: ComparisonItem[]
  /** Customer comparison (if requested) */
  customerComparison?: ComparisonItem[]
}

// ============================================
// HELPERS
// ============================================

function formatPeriodLabel(period: Period): string {
  if (period.label) {
    return period.label
  }
  return `${period.start} a ${period.end}`
}

function calculateChangePercent(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null
  return Math.round(((current - previous) / previous) * 100 * 10) / 10
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const compareSalesPeriods: Skill<
  typeof CompareSalesPeriodsInputSchema,
  CompareSalesPeriodsOutput
> = {
  name: 'compare_sales_periods',

  description: `Comparar ventas entre dos períodos (ej: este mes vs el anterior, este año vs el pasado).
USAR PARA: "compará ventas", "cómo estamos vs mes pasado", "evolución", "crecimiento".
Opcional: includeProducts/includeCustomers para breakdown detallado.
Soporta filtro por equipo (teamId). SIEMPRE llamar get_sales_teams primero para obtener el ID.`,

  tool: 'odoo',

  inputSchema: CompareSalesPeriodsInputSchema,

  tags: ['sales', 'comparison', 'trends', 'reporting', 'analytics'],

  priority: 12, // Good priority for comparison queries

  async execute(
    input: CompareSalesPeriodsInput,
    context: SkillContext
  ): Promise<SkillResult<CompareSalesPeriodsOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo')
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo)
      
      // Use defaults if periods not provided
      const currentPeriod = input.currentPeriod || getDefaultPeriod()
      const previousPeriod = input.previousPeriod || getPreviousMonthPeriod()

      // Helper to get period summary
      async function getPeriodSummary(period: Period): Promise<PeriodSummary> {
        const dateDomain = dateRange('date_order', period.start, period.end)
        const stateDomain = stateFilter(input.state, 'sale.order')
        const domain: OdooDomain = combineDomains(dateDomain, stateDomain)

        // Filter by sales team if specified
        if (input.teamId) {
          domain.push(['team_id', '=', input.teamId])
        }

        // Get totals
        const totals = await odoo.readGroup('sale.order', domain, ['amount_total', 'amount_untaxed', 'partner_id'], [], {
          limit: 1,
        })

        const totalSalesWithTax = totals[0]?.amount_total || 0
        const totalSalesWithoutTax = totals[0]?.amount_untaxed || 0

        // Get order count and unique customers
        const orders = await odoo.searchRead('sale.order', domain, {
          fields: ['id', 'partner_id'],
          limit: 10000,
        })

        const orderCount = orders.length
        const uniqueCustomers = new Set(
          orders.map((o: any) => (Array.isArray(o.partner_id) ? o.partner_id[0] : o.partner_id))
        )

        return {
          totalSalesWithTax,
          totalSalesWithoutTax,
          orderCount,
          customerCount: uniqueCustomers.size,
          avgOrderValueWithTax: orderCount > 0 ? Math.round(totalSalesWithTax / orderCount) : 0,
          avgOrderValueWithoutTax: orderCount > 0 ? Math.round(totalSalesWithoutTax / orderCount) : 0,
          periodLabel: formatPeriodLabel(period),
        }
      }

      // Get both period summaries in parallel
      const [current, previous] = await Promise.all([
        getPeriodSummary(currentPeriod),
        getPeriodSummary(previousPeriod),
      ])

      // Calculate changes
      const salesChange = current.totalSalesWithTax - previous.totalSalesWithTax
      const salesChangePercent = calculateChangePercent(current.totalSalesWithTax, previous.totalSalesWithTax)
      const orderCountChange = current.orderCount - previous.orderCount
      const avgOrderValueChange = current.avgOrderValueWithTax - previous.avgOrderValueWithTax

      // Determine trend
      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (salesChangePercent !== null) {
        if (salesChangePercent > 5) trend = 'up'
        else if (salesChangePercent < -5) trend = 'down'
      }

      // Product comparison if requested
      let productComparison: ComparisonItem[] | undefined
      if (input.includeProducts) {
        const currentDateDomain = dateRange('order_id.date_order', currentPeriod.start, currentPeriod.end)
        const previousDateDomain = dateRange('order_id.date_order', previousPeriod.start, previousPeriod.end)
        const stateDomain = stateFilter(input.state, 'sale.order')
        const stateOnOrder = stateDomain.map((f) => ['order_id.' + f[0], f[1], f[2]] as [string, string, any])

        // Build base domain with team filter for sale.order.line
        const productBaseDomain: DomainFilter[] = []
        if (input.teamId) {
          productBaseDomain.push(['order_id.team_id', '=', input.teamId])
        }

        const [currentProducts, previousProducts] = await Promise.all([
          odoo.readGroup(
            'sale.order.line',
            combineDomains(currentDateDomain, [...stateOnOrder, ...productBaseDomain]),
            ['product_id', 'price_total', 'price_subtotal'],
            ['product_id'],
            { orderBy: 'price_total desc', limit: input.limit }
          ),
          odoo.readGroup(
            'sale.order.line',
            combineDomains(previousDateDomain, [...stateOnOrder, ...productBaseDomain]),
            ['product_id', 'price_total', 'price_subtotal'],
            ['product_id'],
            { orderBy: 'price_total desc', limit: input.limit }
          ),
        ])

        // Build comparison map
        const previousMap = new Map<number, number>()
        previousProducts.forEach((p: any) => {
          const id = Array.isArray(p.product_id) ? p.product_id[0] : p.product_id
          previousMap.set(id, p.price_total || 0)
        })

        productComparison = currentProducts.map((p: any) => {
          const id = Array.isArray(p.product_id) ? p.product_id[0] : p.product_id
          const name = Array.isArray(p.product_id) ? p.product_id[1] : 'Producto'
          const currentSales = p.price_total || 0
          const previousSales = previousMap.get(id) || 0
          const change = currentSales - previousSales

          return {
            id,
            name,
            currentSales,
            previousSales,
            change,
            changePercent: calculateChangePercent(currentSales, previousSales),
          }
        })
      }

      // Customer comparison if requested
      let customerComparison: ComparisonItem[] | undefined
      if (input.includeCustomers) {
        const currentDateDomain = dateRange('date_order', currentPeriod.start, currentPeriod.end)
        const previousDateDomain = dateRange('date_order', previousPeriod.start, previousPeriod.end)
        const stateDomain = stateFilter(input.state, 'sale.order')

        // Build base domain with team filter for sale.order
        const customerBaseDomain: DomainFilter[] = []
        if (input.teamId) {
          customerBaseDomain.push(['team_id', '=', input.teamId])
        }

        const [currentCustomers, previousCustomers] = await Promise.all([
          odoo.readGroup(
            'sale.order',
            combineDomains(currentDateDomain, [...stateDomain, ...customerBaseDomain]),
            ['partner_id', 'amount_total'],
            ['partner_id'],
            { orderBy: 'amount_total desc', limit: input.limit }
          ),
          odoo.readGroup(
            'sale.order',
            combineDomains(previousDateDomain, [...stateDomain, ...customerBaseDomain]),
            ['partner_id', 'amount_total'],
            ['partner_id'],
            { orderBy: 'amount_total desc', limit: input.limit }
          ),
        ])

        // Build comparison map
        const previousMap = new Map<number, number>()
        previousCustomers.forEach((c: any) => {
          const id = Array.isArray(c.partner_id) ? c.partner_id[0] : c.partner_id
          previousMap.set(id, c.amount_total || 0)
        })

        customerComparison = currentCustomers.map((c: any) => {
          const id = Array.isArray(c.partner_id) ? c.partner_id[0] : c.partner_id
          const name = Array.isArray(c.partner_id) ? c.partner_id[1] : 'Cliente'
          const currentSales = c.amount_total || 0
          const previousSales = previousMap.get(id) || 0
          const change = currentSales - previousSales

          return {
            id,
            name,
            currentSales,
            previousSales,
            change,
            changePercent: calculateChangePercent(currentSales, previousSales),
          }
        })
      }

      return success({
        current,
        previous,
        salesChange,
        salesChangePercent,
        orderCountChange,
        avgOrderValueChange,
        trend,
        productComparison,
        customerComparison,
      })
    } catch (error) {
      return errorToResult(error)
    }
  },
}
