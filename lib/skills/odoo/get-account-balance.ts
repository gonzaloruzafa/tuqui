/**
 * Skill: get_account_balance
 *
 * Retrieves balances from the chart of accounts (account.move.line).
 * Answers "saldo de la cuenta 1.1.1" type questions.
 *
 * @example
 * User: "Saldo de la cuenta 1.1.1.01"
 * User: "Saldos contables del mes"
 * User: "Balance de cuentas"
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult, Period } from '../types';
import { PeriodSchema, success, authError } from '../types';
import { createOdooClient, dateRange, combineDomains, getDefaultPeriod, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetAccountBalanceInputSchema = z.object({
  /** Date period to filter moves */
  period: PeriodSchema.optional(),
  /** Filter by account code prefix (e.g. "1.1.1" matches 1.1.1.*) */
  accountCode: z.string().optional(),
  /** Filter by specific account IDs */
  accountIds: z.array(z.number().positive()).optional(),
  /** Company ID. Obtener de get_companies, NO adivinar. */
  companyId: z.number().int().positive().optional(),
  /** Max accounts to return */
  limit: z.number().min(1).max(200).default(50),
});

export type GetAccountBalanceInput = z.infer<typeof GetAccountBalanceInputSchema>;

// ============================================
// OUTPUT TYPES
// ============================================

export interface AccountBalance {
  accountId: number;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface GetAccountBalanceOutput {
  accounts: AccountBalance[];
  totalDebit: number;
  totalCredit: number;
  totalBalance: number;
  period: Period;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getAccountBalance: Skill<typeof GetAccountBalanceInputSchema, GetAccountBalanceOutput> = {
  name: 'get_account_balance',

  description: `Saldos del plan de cuentas contables (balancete).
USAR PARA: "saldo de la cuenta 1.1.1", "balance contable", "saldos de cuentas", "cuánto hay en la cuenta X", "balancete".
Filtra por código de cuenta (prefix match) y período.
Soporta filtro por compañía (companyId). SIEMPRE llamar get_companies primero para obtener el ID.
Retorna: debit, credit, balance por cuenta.`,

  tool: 'odoo',
  inputSchema: GetAccountBalanceInputSchema,
  tags: ['accounting', 'balance', 'chart-of-accounts', 'ledger'],
  priority: 12,

  async execute(input: GetAccountBalanceInput, context: SkillContext): Promise<SkillResult<GetAccountBalanceOutput>> {
    if (!context.credentials.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const period = input.period || getDefaultPeriod();

      let domain: OdooDomain = combineDomains(
        [['parent_state', '=', 'posted']],
        dateRange('date', period.start, period.end)
      );

      if (input.companyId) {
        domain = [...domain, ['company_id', '=', input.companyId]];
      }
      if (input.accountCode) {
        domain = [...domain, ['account_id.code', '=like', `${input.accountCode}%`]];
      }
      if (input.accountIds?.length) {
        domain = [...domain, ['account_id', 'in', input.accountIds]];
      }

      const grouped = await odoo.readGroup(
        'account.move.line',
        domain,
        ['account_id', 'debit:sum', 'credit:sum', 'balance:sum'],
        ['account_id'],
        { limit: input.limit, orderBy: 'account_id asc' }
      );

      const accounts: AccountBalance[] = grouped.map((g: any) => ({
        accountId: Array.isArray(g.account_id) ? g.account_id[0] : g.account_id,
        accountCode: Array.isArray(g.account_id) ? g.account_id[1]?.split(' ')[0] || '' : '',
        accountName: Array.isArray(g.account_id) ? g.account_id[1] || '' : '',
        debit: g.debit || 0,
        credit: g.credit || 0,
        balance: g.balance || 0,
      }));

      const totalDebit = accounts.reduce((s, a) => s + a.debit, 0);
      const totalCredit = accounts.reduce((s, a) => s + a.credit, 0);
      const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

      return success({ accounts, totalDebit, totalCredit, totalBalance, period });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
