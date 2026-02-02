/**
 * Integration test: Verify Skills load correctly in chat context
 */

import { describe, it, expect } from 'vitest';
import { loadSkillsForAgent, hasOdooTools, shouldUseSkills } from '@/lib/skills/loader';

describe('Skills Integration', () => {
  describe('Integration Detection', () => {
    it('detects Odoo tools in agent config', () => {
      expect(hasOdooTools(['odoo', 'web_search'])).toBe(true);
      expect(hasOdooTools(['odoo_sales', 'odoo_inventory'])).toBe(true);
      expect(hasOdooTools(['web_search'])).toBe(false);
      expect(hasOdooTools([])).toBe(false);
    });

    it('should use Skills for all tenants', async () => {
      const result = await shouldUseSkills('test-tenant-123');
      expect(result).toBe(true);
    });
  });

  describe('Skill Loading (without credentials)', () => {
    it('returns empty object when no Odoo credentials available', async () => {
      // This will fail to load Odoo credentials (no integration in DB)
      const tools = await loadSkillsForAgent(
        'non-existent-tenant',
        'test-user@example.com',
        ['odoo']
      );

      // Should return empty object when credentials not found
      expect(tools).toEqual({});
    });
  });
});
