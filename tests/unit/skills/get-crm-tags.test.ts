/**
 * Tests for get_crm_tags skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCrmTags, GetCrmTagsInputSchema } from '@/lib/skills/odoo/get-crm-tags';
import type { SkillContext } from '@/lib/skills/types';
import * as clientModule from '@/lib/skills/odoo/_client';

vi.mock('@/lib/skills/odoo/_client', () => ({
  createOdooClient: vi.fn(),
}));

describe('Skill: get_crm_tags', () => {
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
    it('defaults includeStats to true', () => {
      const result = GetCrmTagsInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.includeStats).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await getCrmTags.execute(
        { includeStats: true },
        { ...mockContext, credentials: {} }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('returns tags with opportunity counts', async () => {
      mockOdoo.searchRead.mockResolvedValueOnce([
        { id: 1, name: 'Enterprise' },
        { id: 2, name: 'Urgente' },
        { id: 3, name: 'Partner' },
      ]);
      mockOdoo.readGroup.mockResolvedValueOnce([
        { tag_ids: [1, 'Enterprise'], tag_ids_count: 5 },
        { tag_ids: [2, 'Urgente'], tag_ids_count: 3 },
      ]);

      const result = await getCrmTags.execute({ includeStats: true }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalTags).toBe(3);
        expect(result.data.tags[0]).toEqual({ id: 1, name: 'Enterprise', opportunityCount: 5 });
        expect(result.data.tags[2]).toEqual({ id: 3, name: 'Partner', opportunityCount: 0 });
      }
    });

    it('returns tags without stats when includeStats=false', async () => {
      mockOdoo.searchRead.mockResolvedValueOnce([
        { id: 1, name: 'Enterprise' },
      ]);

      const result = await getCrmTags.execute({ includeStats: false }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags[0]).toEqual({ id: 1, name: 'Enterprise' });
        expect(result.data.tags[0]).not.toHaveProperty('opportunityCount');
      }
      // Should NOT call readGroup
      expect(mockOdoo.readGroup).not.toHaveBeenCalled();
    });
  });
});
