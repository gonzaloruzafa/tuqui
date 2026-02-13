/**
 * Tests for get_crm_pipeline skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCrmPipeline, GetCrmPipelineInputSchema } from '@/lib/skills/odoo/get-crm-pipeline';
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
}));

describe('Skill: get_crm_pipeline', () => {
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
      const result = GetCrmPipelineInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('open');
        expect(result.data.groupByStage).toBe(true);
        expect(result.data.limit).toBe(50);
      }
    });

    it('accepts specific status', () => {
      const result = GetCrmPipelineInputSchema.safeParse({ status: 'won' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.status).toBe('won');
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getCrmPipeline.execute(
        { status: 'open', groupByStage: true, limit: 50 },
        { ...mockContext, credentials: {} }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('returns pipeline grouped by stage', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([
        { stage_id: [1, 'Nuevo'], stage_id_count: 5, expected_revenue: 100000, probability: 20 },
        { stage_id: [2, 'Propuesta'], stage_id_count: 3, expected_revenue: 250000, probability: 50 },
        { stage_id: [3, 'Negociación'], stage_id_count: 2, expected_revenue: 180000, probability: 75 },
      ]);

      const result = await getCrmPipeline.execute(
        { status: 'open', groupByStage: true, limit: 50 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalOpportunities).toBe(10);
        expect(result.data.totalExpectedRevenue).toBe(530000);
        expect(result.data.stages).toHaveLength(3);
        expect(result.data.stages[0].stageName).toBe('Nuevo');
        expect(result.data.stages[0].count).toBe(5);
      }
    });

    it('returns empty pipeline', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([]);

      const result = await getCrmPipeline.execute(
        { status: 'open', groupByStage: true, limit: 50 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalOpportunities).toBe(0);
        expect(result.data.stages).toEqual([]);
      }
    });

    it('includes won/lost counts when status=all', async () => {
      mockOdoo.readGroup.mockResolvedValueOnce([
        { stage_id: [1, 'Nuevo'], stage_id_count: 2, expected_revenue: 50000, probability: 20 },
      ]);
      mockOdoo.searchCount
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(3);

      const result = await getCrmPipeline.execute(
        { status: 'all', groupByStage: true, limit: 50 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.wonCount).toBe(8);
        expect(result.data.lostCount).toBe(3);
      }
    });
  });
});
