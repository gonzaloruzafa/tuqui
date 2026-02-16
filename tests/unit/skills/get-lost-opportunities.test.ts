/**
 * Tests for get_lost_opportunities skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLostOpportunities, GetLostOpportunitiesInputSchema } from '@/lib/skills/odoo/get-lost-opportunities';
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
  getDefaultPeriod: () => ({ start: '2026-02-01', end: '2026-02-28', label: 'Este mes' }),
  };
});

describe('Skill: get_lost_opportunities', () => {
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
    it('accepts defaults with no period', () => {
      const result = GetLostOpportunitiesInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.limit).toBe(10);
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getLostOpportunities.execute(
        { limit: 10 },
        { ...mockContext, credentials: {} }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('ranks lost reasons by revenue desc with percentages', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([
        { lost_reason_id: [1, 'Precio'], lost_reason_id_count: 5, expected_revenue: 300000 },
        { lost_reason_id: [2, 'Competencia'], lost_reason_id_count: 3, expected_revenue: 150000 },
        { lost_reason_id: false, __count: 2, expected_revenue: 50000 },
      ]);
      mockOdoo.searchRead.mockResolvedValueOnce([
        {
          id: 1, name: 'Big Deal', partner_id: [10, 'Corp A'], lost_reason_id: [1, 'Precio'],
          expected_revenue: 200000, stage_id: [3, 'Negociación'], date_closed: '2026-02-10',
          user_id: [5, 'Juan'],
        },
      ]);

      const result = await getLostOpportunities.execute(
        { period: { start: '2026-02-01', end: '2026-02-28' }, limit: 10 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalLost).toBe(10);
        expect(result.data.totalLostRevenue).toBe(500000);
        // Precio is #1 by revenue
        expect(result.data.lostReasons[0].reasonName).toBe('Precio');
        expect(result.data.lostReasons[0].percentage).toBe(50); // 5/10
        expect(result.data.lostReasons[1].reasonName).toBe('Competencia');
        expect(result.data.lostReasons[1].percentage).toBe(30); // 3/10
        // Top deal
        expect(result.data.topLostDeals[0].name).toBe('Big Deal');
        expect(result.data.topLostDeals[0].reason).toBe('Precio');
      }
    });

    it('handles no lost opportunities', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([]);
      mockOdoo.searchRead.mockResolvedValueOnce([]);

      const result = await getLostOpportunities.execute(
        { period: { start: '2026-02-01', end: '2026-02-28' }, limit: 10 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalLost).toBe(0);
        expect(result.data.lostReasons).toEqual([]);
        expect(result.data.topLostDeals).toEqual([]);
      }
    });

    it('applies tagId filter', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([]);
      mockOdoo.searchRead.mockResolvedValueOnce([]);

      await getLostOpportunities.execute(
        { period: { start: '2026-02-01', end: '2026-02-28' }, tagId: 7, limit: 10 },
        mockContext
      );

      const domain = mockOdoo.readGroup.mock.calls[0][1];
      expect(domain).toContainEqual(['tag_ids', 'in', [7]]);
    });
  });
});
