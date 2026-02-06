import { describe, it, expect, vi, beforeEach } from 'vitest';
import { memoryTool } from '@/lib/tools/definitions/memory-tool';
import * as supabaseClient from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({
  getClient: vi.fn(),
}));

describe('Memory Tool', () => {
  const mockDb = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (supabaseClient.getClient as any).mockReturnValue(mockDb);
  });

  it('should return found insights when matches exist', async () => {
    mockDb.limit.mockResolvedValue({
      data: [
        {
          entity_type: 'customer',
          entity_name: 'MegaCorp',
          insight: 'Paga tarde',
          created_at: '2026-01-01'
        }
      ],
      error: null,
    });

    const result = await memoryTool.execute(
      { entity_name: 'Mega' },
      { tenantId: 'tenant-123' }
    );

    expect(result.found).toBe(true);
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].note).toBe('Paga tarde');
  });

  it('should return not found message when no matches exist', async () => {
    mockDb.limit.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await memoryTool.execute(
      { entity_name: 'Unknown' },
      { tenantId: 'tenant-123' }
    );

    expect(result.found).toBe(false);
    expect(result.message).toContain('No hay notas previas');
  });
});
