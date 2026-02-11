/**
 * Skill: get_cash_balance
 *
 * Retrieves current cash balance from cash journals.
 * Answers "¿Cuánta plata en caja?" type questions.
 *
 * @example
 * User: "¿Cuánta plata en caja?"
 * User: "Saldo de caja"
 * User: "Efectivo disponible"
 */

import { z } from 'zod'
import type { Skill, SkillContext, SkillResult } from '../types'
import { success, authError } from '../types'
import { createOdooClient, type OdooDomain } from './_client'
import { errorToResult } from '../errors'

// ============================================
// INPUT SCHEMA
// ============================================

export const GetCashBalanceInputSchema = z.object({
  /** Include bank accounts (not just cash) - defaults to true for completeness */
  includeBanks: z.boolean().default(true),
  /** Filter by specific journal IDs */
  journalIds: z.array(z.number().positive()).optional(),
  /** Company ID. Obtener de get_companies, NO adivinar. */
  companyId: z.number().int().positive().optional(),
})

export type GetCashBalanceInput = z.infer<typeof GetCashBalanceInputSchema>

// ============================================
// OUTPUT TYPES
// ============================================

export interface JournalBalance {
  /** Journal ID */
  journalId: number
  /** Journal name (e.g., "Caja Principal", "Banco Nación") */
  journalName: string
  /** Journal type: cash or bank */
  journalType: 'cash' | 'bank'
  /** Current balance */
  balance: number
  /** Currency */
  currency: string
  /** Company ID that owns this journal */
  companyId: number
  /** Company name */
  companyName: string
}

export interface GetCashBalanceOutput {
  /** Total cash balance (only cash journals) */
  totalCash: number
  /** Total bank balance (only bank journals) */
  totalBank: number
  /** Combined total (cash + bank) */
  grandTotal: number
  /** Breakdown by journal */
  journals: JournalBalance[]
  /** Default currency */
  currency: string
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getCashBalance: Skill<typeof GetCashBalanceInputSchema, GetCashBalanceOutput> = {
  name: 'get_cash_balance',

  description: `Saldo de caja y bancos (tesorería).
USAR PARA: "cuánto tenemos en bancos", "saldo en caja", "plata disponible", "liquidez".
Para ver liquidez de TODAS las compañías: llamar SIN companyId → devuelve TODOS los diarios con su compañía.
Para ver liquidez de UNA compañía: llamar con companyId (obtener de get_companies primero).
Cada diario incluye companyId y companyName para identificar a qué empresa pertenece.
Retorna: saldo por caja/banco y total combinado.`,

  tool: 'odoo',

  inputSchema: GetCashBalanceInputSchema,

  tags: ['cash', 'balance', 'treasury', 'banks', 'liquidity'],

  priority: 15, // High priority for common treasury questions

  async execute(
    input: GetCashBalanceInput,
    context: SkillContext
  ): Promise<SkillResult<GetCashBalanceOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo')
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo)

      // Build domain for journals
      const journalTypes: string[] = ['cash']
      if (input.includeBanks) {
        journalTypes.push('bank')
      }

      let domain: OdooDomain = [['type', 'in', journalTypes]]

      // Add company filter
      if (input.companyId) {
        domain = [...domain, ['company_id', '=', input.companyId]]
      }

      // Add specific journal filter if provided
      if (input.journalIds && input.journalIds.length > 0) {
        domain = [...domain, ['id', 'in', input.journalIds]]
      }

      // Get journals with their current balance
      const journals = await odoo.searchRead('account.journal', domain, {
        fields: ['id', 'name', 'type', 'default_account_id', 'currency_id', 'company_id'],
      })

      // For each journal, get the account balance
      const journalBalances: JournalBalance[] = []
      let totalCash = 0
      let totalBank = 0
      let defaultCurrency = 'ARS'

      for (const journal of journals) {
        // Get the default account for this journal
        const accountId = Array.isArray(journal.default_account_id)
          ? journal.default_account_id[0]
          : journal.default_account_id

        if (!accountId) continue

        // Get balance from account.move.line
        const balanceResult = await odoo.readGroup(
          'account.move.line',
          [
            ['account_id', '=', accountId],
            ['parent_state', '=', 'posted'],
          ],
          ['balance'],
          [],
          { limit: 1 }
        )

        const balance = balanceResult[0]?.balance || 0
        const journalType = journal.type === 'cash' ? 'cash' : 'bank'
        const currency = Array.isArray(journal.currency_id)
          ? journal.currency_id[1]
          : defaultCurrency

        if (journalType === 'cash') {
          totalCash += balance
        } else {
          totalBank += balance
        }

        journalBalances.push({
          journalId: journal.id,
          journalName: journal.name,
          journalType,
          balance,
          currency,
          companyId: Array.isArray(journal.company_id) ? journal.company_id[0] : journal.company_id,
          companyName: Array.isArray(journal.company_id) ? journal.company_id[1] : 'Desconocida',
        })

        // Use first currency as default
        if (!defaultCurrency && currency) {
          defaultCurrency = currency
        }
      }

      return success({
        totalCash,
        totalBank,
        grandTotal: totalCash + totalBank,
        journals: journalBalances.sort((a, b) => b.balance - a.balance),
        currency: defaultCurrency,
      })
    } catch (error) {
      return errorToResult(error)
    }
  },
}
