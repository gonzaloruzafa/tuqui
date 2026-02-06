import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStructuredCompanyContext } from '@/lib/company/context-injector';
import * as supabaseClient from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({
  getClient: vi.fn(),
}));

describe('Company Context Injector', () => {
  const mockDb = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (supabaseClient.getClient as any).mockReturnValue(mockDb);
  });

  it('should format structured context correctly', async () => {
    // Mock tenant response
    mockDb.single.mockResolvedValueOnce({
      data: { name: 'Cedent S.A.', industry: 'Odontología' },
      error: null,
    });
    // Mock company_contexts response
    mockDb.single.mockResolvedValueOnce({
      data: {
        key_customers: [{ name: 'MegaDent', notes: 'Comprador frecuente' }],
        business_rules: ['Margen mínimo 30%'],
      },
      error: null,
    });

    const context = await getStructuredCompanyContext('tenant-123');

    expect(context).toContain('Cedent S.A.');
    expect(context).toContain('MegaDent');
    expect(context).toContain('Margen mínimo 30%');
    expect(context).toContain('--- CONTEXTO ESTRATEGICO DE LA EMPRESA ---');
  });

  it('should return null if no context is found', async () => {
    mockDb.single.mockResolvedValue({ data: null, error: null });

    const context = await getStructuredCompanyContext('tenant-123');
    expect(context).toBeNull();
  });
});
