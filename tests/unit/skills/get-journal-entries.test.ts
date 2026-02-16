/**
 * Tests for get_journal_entries skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getJournalEntries, GetJournalEntriesInputSchema } from '@/lib/skills/odoo/get-journal-entries';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/skills/odoo/_client')>('@/lib/skills/odoo/_client');
  return {
    formatMonto: actual.formatMonto,
  createOdooClient: vi.fn(),
  dateRange: (field: string, start: string, end: string) => [
    [field, '>=', start],
    [field, '<=', end],
  ],
  combineDomains: (...domains: any[]) => domains.flat().filter(Boolean),
  getDefaultPeriod: () => ({ start: '2025-01-01', end: '2025-01-31' }),
  };
});

describe('Skill: get_journal_entries', () => {
  const mockContext: SkillContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    credentials: {
      odoo: { url: 'https://test.odoo.com', db: 'test', username: 'admin', apiKey: 'key' },
    },
  };

  const mockOdoo = { searchRead: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.createOdooClient).mockReturnValue(mockOdoo as any);
  });

  describe('Input Validation', () => {
    it('accepts empty input', () => {
      expect(GetJournalEntriesInputSchema.safeParse({}).success).toBe(true);
    });

    it('accepts single moveType', () => {
      expect(GetJournalEntriesInputSchema.safeParse({ moveType: 'entry' }).success).toBe(true);
    });

    it('accepts array of moveTypes', () => {
      expect(GetJournalEntriesInputSchema.safeParse({ moveType: ['out_invoice', 'out_refund'] }).success).toBe(true);
    });

    it('accepts accountCode filter', () => {
      expect(GetJournalEntriesInputSchema.safeParse({ accountCode: '5.1' }).success).toBe(true);
    });

    it('accepts customerName filter', () => {
      expect(GetJournalEntriesInputSchema.safeParse({ customerName: 'Fundacion Instituto' }).success).toBe(true);
    });

    it('accepts partnerId filter', () => {
      expect(GetJournalEntriesInputSchema.safeParse({ partnerId: 2717 }).success).toBe(true);
    });

    it('rejects invalid moveType', () => {
      expect(GetJournalEntriesInputSchema.safeParse({ moveType: 'invalid' }).success).toBe(false);
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR without credentials', async () => {
      const result = await getJournalEntries.execute({ state: 'posted', limit: 50 }, { ...mockContext, credentials: {} });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('returns journal entries', async () => {
      mockOdoo.searchRead.mockResolvedValue([
        { id: 1, name: 'INV/2025/001', date: '2025-01-15', move_type: 'out_invoice', partner_id: [1, 'Cliente A'], journal_id: [1, 'Ventas'], amount_total: 10000, state: 'posted' },
        { id: 2, name: 'BILL/2025/001', date: '2025-01-20', move_type: 'in_invoice', partner_id: [2, 'Proveedor B'], journal_id: [2, 'Compras'], amount_total: 5000, state: 'posted' },
      ]);

      const result = await getJournalEntries.execute({ state: 'posted', limit: 50 }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entries).toHaveLength(2);
        expect(result.data.totalAmount).toBe(15000);
        expect(result.data.entryCount).toBe(2);
      }
    });

    it('filters by account code using two-step query', async () => {
      // First call: searchRead on account.move.line to find move IDs
      mockOdoo.searchRead.mockResolvedValueOnce([
        { move_id: [10, 'INV/001'] },
        { move_id: [20, 'INV/002'] },
      ]);
      // Second call: searchRead on account.move
      mockOdoo.searchRead.mockResolvedValueOnce([
        { id: 10, name: 'INV/001', date: '2025-01-15', move_type: 'out_invoice', partner_id: [1, 'A'], journal_id: [1, 'V'], amount_total: 100, state: 'posted' },
      ]);

      const result = await getJournalEntries.execute({ accountCode: '5.1', state: 'posted', limit: 50 }, mockContext);

      expect(result.success).toBe(true);
      expect(mockOdoo.searchRead).toHaveBeenCalledTimes(2);
    });

    it('returns empty when account code matches no lines', async () => {
      mockOdoo.searchRead.mockResolvedValueOnce([]); // No lines match

      const result = await getJournalEntries.execute({ accountCode: '9.9.9', state: 'posted', limit: 50 }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entries).toHaveLength(0);
        expect(result.data.entryCount).toBe(0);
      }
    });

    it('handles API errors gracefully', async () => {
      mockOdoo.searchRead.mockRejectedValue(new Error('Connection refused'));
      const result = await getJournalEntries.execute({ state: 'posted', limit: 50 }, mockContext);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('API_ERROR');
    });

    it('adds customerName filter to domain', async () => {
      mockOdoo.searchRead.mockResolvedValue([]);

      await getJournalEntries.execute(
        { state: 'posted', limit: 50, customerName: 'Fundacion Instituto' },
        mockContext
      );

      const domain = mockOdoo.searchRead.mock.calls[0][1];
      expect(domain).toContainEqual(['partner_id.name', 'ilike', 'Fundacion Instituto']);
    });

    it('adds partnerId filter to domain', async () => {
      mockOdoo.searchRead.mockResolvedValue([]);

      await getJournalEntries.execute(
        { state: 'posted', limit: 50, partnerId: 2717 },
        mockContext
      );

      const domain = mockOdoo.searchRead.mock.calls[0][1];
      expect(domain).toContainEqual(['partner_id', '=', 2717]);
    });

    it('does not add customer filter when not provided', async () => {
      mockOdoo.searchRead.mockResolvedValue([]);

      await getJournalEntries.execute({ state: 'posted', limit: 50 }, mockContext);

      const domain = mockOdoo.searchRead.mock.calls[0][1];
      const hasCustomerFilter = domain.some(
        (d: any) => Array.isArray(d) && (d[0] === 'partner_id.name' || (d[0] === 'partner_id' && d[1] === '='))
      );
      expect(hasCustomerFilter).toBe(false);
    });
  });

  describe('Metadata', () => {
    it('has correct name', () => expect(getJournalEntries.name).toBe('get_journal_entries'));
    it('has description', () => expect(getJournalEntries.description.length).toBeGreaterThan(10));
    it('has tags', () => expect(getJournalEntries.tags).toContain('accounting'));
  });
});
