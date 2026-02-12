/**
 * Tests for get_inactive_customers skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInactiveCustomers, GetInactiveCustomersInputSchema } from '@/lib/skills/odoo/get-inactive-customers';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', () => ({
  createOdooClient: vi.fn(),
  dateRange: (field: string, start: string, end: string) => [
    [field, '>=', start],
    [field, '<=', end],
  ],
  combineDomains: (...domains: any[]) => domains.flat().filter(Boolean),
  getDefaultPeriod: () => ({ start: '2026-02-01', end: '2026-02-28', label: 'Este mes' }),
  getPreviousMonthPeriod: () => ({ start: '2026-01-01', end: '2026-01-31', label: 'Mes pasado' }),
}));

describe('Skill: get_inactive_customers', () => {
  const mockContext: SkillContext = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    credentials: {
      odoo: { url: 'https://test.odoo.com', db: 'test_db', username: 'admin', apiKey: 'key' },
    },
  };

  const mockOdoo = { readGroup: vi.fn(), searchRead: vi.fn(), searchCount: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.createOdooClient).mockReturnValue(mockOdoo as any);
  });

  describe('Input Validation', () => {
    it('accepts empty input with defaults', () => {
      const result = GetInactiveCustomersInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.includeDetails).toBe(true);
      }
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getInactiveCustomers.execute({}, { ...mockContext, credentials: {} });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('finds customers who bought before but not now', async () => {
      mockOdoo.readGroup
        .mockResolvedValueOnce([
          { partner_id: [1, 'Cliente A'], amount_total: 50000, partner_id_count: 5 },
          { partner_id: [2, 'Cliente B'], amount_total: 30000, partner_id_count: 3 },
          { partner_id: [3, 'Cliente C'], amount_total: 10000, partner_id_count: 1 },
        ])
        .mockResolvedValueOnce([
          { partner_id: [1, 'Cliente A'], partner_id_count: 2 },
        ]);

      mockOdoo.searchRead
        .mockResolvedValueOnce([
          { id: 2, email: 'b@test.com', phone: '1234', city: 'CABA' },
          { id: 3, email: 'c@test.com', phone: '5678', city: 'Córdoba' },
        ])
        .mockResolvedValueOnce([{ date_order: '2026-01-15 10:00:00' }])
        .mockResolvedValueOnce([{ date_order: '2026-01-05 14:30:00' }]);

      const result = await getInactiveCustomers.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalInactive).toBe(2);
        expect(result.data.customers).toHaveLength(2);
        expect(result.data.customers[0].customerName).toBe('Cliente B');
        expect(result.data.customers[0].previousPeriodAmount).toBe(30000);
        expect(result.data.customers[0].email).toBe('b@test.com');
        expect(result.data.totalLostRevenue).toBe(40000);
      }
    });

    it('returns empty when no previous customers', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([]);

      const result = await getInactiveCustomers.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalInactive).toBe(0);
        expect(result.data.customers).toEqual([]);
      }
    });

    it('returns empty when all previous customers still buying', async () => {
      mockOdoo.readGroup
        .mockResolvedValueOnce([
          { partner_id: [1, 'Cliente Fiel'], amount_total: 80000, partner_id_count: 10 },
        ])
        .mockResolvedValueOnce([
          { partner_id: [1, 'Cliente Fiel'], partner_id_count: 5 },
        ]);

      const result = await getInactiveCustomers.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalInactive).toBe(0);
      }
    });
  });
});
