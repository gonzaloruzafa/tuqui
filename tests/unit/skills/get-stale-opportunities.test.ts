/**
 * Tests for get_stale_opportunities skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStaleOpportunities, GetStaleOpportunitiesInputSchema } from '@/lib/skills/odoo/get-stale-opportunities';
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

describe('Skill: get_stale_opportunities', () => {
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
    it('accepts defaults', () => {
      const result = GetStaleOpportunitiesInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staleDays).toBe(30);
        expect(result.data.limit).toBe(15);
      }
    });

    it('accepts custom staleDays', () => {
      const result = GetStaleOpportunitiesInputSchema.safeParse({ staleDays: 60 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.staleDays).toBe(60);
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getStaleOpportunities.execute(
        { staleDays: 30, limit: 15 },
        { ...mockContext, credentials: {} }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('detects stale opportunities grouped by stage', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([
        { stage_id: [2, 'Propuesta'], stage_id_count: 4, expected_revenue: 200000, date_last_stage_update: '2025-12-01' },
        { stage_id: [3, 'Negociación'], stage_id_count: 2, expected_revenue: 150000, date_last_stage_update: '2026-01-01' },
      ]);
      mockOdoo.searchRead.mockResolvedValueOnce([
        {
          id: 10, name: 'Deal A', partner_id: [1, 'Cliente A'], stage_id: [2, 'Propuesta'],
          date_last_stage_update: '2025-12-15', expected_revenue: 80000, user_id: [5, 'Juan'],
        },
      ]);

      const result = await getStaleOpportunities.execute(
        { staleDays: 30, limit: 15 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalStaleCount).toBe(6);
        expect(result.data.totalStaleRevenue).toBe(350000);
        expect(result.data.stageBreakdown).toHaveLength(2);
        expect(result.data.stageBreakdown[0].stageName).toBe('Propuesta');
        expect(result.data.topStaleOpportunities).toHaveLength(1);
        expect(result.data.topStaleOpportunities[0].name).toBe('Deal A');
        expect(result.data.topStaleOpportunities[0].daysSinceUpdate).toBeGreaterThan(30);
      }
    });

    it('returns empty when no stale opportunities', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([]);
      mockOdoo.searchRead.mockResolvedValueOnce([]);

      const result = await getStaleOpportunities.execute(
        { staleDays: 30, limit: 15 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalStaleCount).toBe(0);
        expect(result.data.totalStaleRevenue).toBe(0);
        expect(result.data.stageBreakdown).toEqual([]);
      }
    });

    it('applies stageId filter to domain', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([]);
      mockOdoo.searchRead.mockResolvedValueOnce([]);

      await getStaleOpportunities.execute(
        { staleDays: 30, stageId: 5, limit: 15 },
        mockContext
      );

      const readGroupDomain = mockOdoo.readGroup.mock.calls[0][1];
      expect(readGroupDomain).toContainEqual(['stage_id', '=', 5]);
    });
  });
});
