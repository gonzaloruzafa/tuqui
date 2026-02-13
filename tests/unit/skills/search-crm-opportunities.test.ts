/**
 * Tests for search_crm_opportunities skill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchCrmOpportunities, SearchCrmOpportunitiesInputSchema } from '@/lib/skills/odoo/search-crm-opportunities';
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

describe('Skill: search_crm_opportunities', () => {
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
      const result = SearchCrmOpportunitiesInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('open');
        expect(result.data.includeQuotes).toBe(false);
        expect(result.data.limit).toBe(20);
      }
    });
  });

  describe('Authentication', () => {
    it('returns AUTH_ERROR when credentials missing', async () => {
      const result = await searchCrmOpportunities.execute(
        { status: 'open', includeQuotes: false, limit: 20 },
        { ...mockContext, credentials: {} }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Execution', () => {
    it('returns opportunities with tags and contact info', async () => {
      mockOdoo.searchRead
        // Opportunities
        .mockResolvedValueOnce([
          {
            id: 1, name: 'Opp A', partner_id: [10, 'Cliente A'], stage_id: [2, 'Propuesta'],
            tag_ids: [5, 8], expected_revenue: 100000, probability: 50, user_id: [3, 'Juan'],
            create_date: '2026-01-15', date_closed: false,
          },
        ])
        // Contacts
        .mockResolvedValueOnce([{ id: 10, email: 'a@test.com', phone: '1234' }])
        // Tags
        .mockResolvedValueOnce([
          { id: 5, name: 'Enterprise' },
          { id: 8, name: 'Urgente' },
        ]);

      const result = await searchCrmOpportunities.execute(
        { status: 'open', includeQuotes: false, limit: 20 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalCount).toBe(1);
        expect(result.data.opportunities[0].tags).toEqual(['Enterprise', 'Urgente']);
        expect(result.data.opportunities[0].partnerEmail).toBe('a@test.com');
        expect(result.data.opportunities[0].stage).toBe('Propuesta');
      }
    });

    it('enriches with linked quotes when includeQuotes=true', async () => {
      mockOdoo.searchRead
        // Opportunities with order_ids
        .mockResolvedValueOnce([
          {
            id: 1, name: 'Opp A', partner_id: [10, 'Cliente A'], stage_id: [2, 'Propuesta'],
            tag_ids: [], expected_revenue: 100000, probability: 50, user_id: [3, 'Juan'],
            create_date: '2026-01-15', date_closed: false, order_ids: [100, 101],
          },
        ])
        // Contacts
        .mockResolvedValueOnce([{ id: 10, email: 'a@test.com', phone: '1234' }])
        // Tags skipped (empty tag_ids → no searchRead)
        // Quotes
        .mockResolvedValueOnce([
          { id: 100, name: 'S00100', amount_total: 50000, state: 'draft' },
          { id: 101, name: 'S00101', amount_total: 80000, state: 'sale' },
        ]);

      const result = await searchCrmOpportunities.execute(
        { status: 'open', includeQuotes: true, limit: 20 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.opportunities[0].quotes).toHaveLength(2);
        expect(result.data.opportunities[0].quotesTotal).toBe(130000);
      }
    });

    it('applies stageId and tagId filters', async () => {
      mockOdoo.searchRead
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await searchCrmOpportunities.execute(
        { status: 'open', stageId: 3, tagId: 5, includeQuotes: false, limit: 20 },
        mockContext
      );

      const domain = mockOdoo.searchRead.mock.calls[0][1];
      expect(domain).toContainEqual(['stage_id', '=', 3]);
      expect(domain).toContainEqual(['tag_ids', 'in', [5]]);
    });
  });
});
