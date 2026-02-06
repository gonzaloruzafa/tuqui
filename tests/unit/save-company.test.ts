/**
 * Unit Tests for saveCompanyContext Server Action
 *
 * Tests auth checks, tenant update, company_contexts upsert,
 * preview generation, and error handling.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockSession = {
  tenant: { id: 'tenant-123' },
  isAdmin: true,
  user: { email: 'admin@test.com' },
}

vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
const mockUpsert = vi.fn().mockResolvedValue({ error: null })
const mockSelectUser = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'user-uuid-123' } }),
    }),
  }),
})

vi.mock('@/lib/supabase/client', () => ({
  getClient: () => ({
    from: (table: string) => {
      if (table === 'tenants') return { update: mockUpdate, select: vi.fn() }
      if (table === 'users') return { select: mockSelectUser }
      if (table === 'company_contexts') return { upsert: mockUpsert }
      return {}
    },
  }),
}))

vi.mock('@/lib/company/context-injector', () => ({
  getCompanyContext: vi.fn().mockResolvedValue({
    context: 'EMPRESA: Test Corp',
    tokenEstimate: 10,
    sources: ['tenant'],
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { auth } = await import('@/lib/auth/config')
const { saveCompanyContext } = await import('@/app/admin/company/actions')

// --- Helpers ---

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const defaults: Record<string, string> = {
    name: 'Test Corp',
    website: 'https://test.com',
    email: 'info@test.com',
    phone: '+54 11 1234',
    address: 'Buenos Aires',
    industry: 'Tecnología',
    description: 'Software ERP',
    tone_of_voice: 'Profesional',
    web_summary: 'Empresa de software',
    scan_url: 'https://test.com',
    key_customers: '[]',
    key_products: '[]',
    business_rules: '[]',
  }
  const fd = new FormData()
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    fd.set(k, v)
  }
  return fd
}

describe('saveCompanyContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('rejects unauthenticated users', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null)

    const result = await saveCompanyContext(buildFormData())

    expect(result.success).toBe(false)
    expect(result.error).toBe('No autorizado')
  })

  test('rejects non-admin users', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      ...mockSession,
      isAdmin: false,
    } as any)

    const result = await saveCompanyContext(buildFormData())

    expect(result.success).toBe(false)
    expect(result.error).toBe('No autorizado')
  })

  test('rejects session without tenant', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      ...mockSession,
      tenant: null,
    } as any)

    const result = await saveCompanyContext(buildFormData())

    expect(result.success).toBe(false)
    expect(result.error).toBe('No autorizado')
  })

  test('saves successfully with valid data', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)

    const result = await saveCompanyContext(buildFormData())

    expect(result.success).toBe(true)
    expect(result.preview).toBeDefined()
    expect(result.preview?.context).toContain('Test Corp')
    expect(result.preview?.sources).toContain('tenant')
  })

  test('updates tenant with form fields', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    const fd = buildFormData({ name: 'Mi Empresa', website: 'https://mi.com' })

    await saveCompanyContext(fd)

    expect(mockUpdate).toHaveBeenCalledWith({
      name: 'Mi Empresa',
      website: 'https://mi.com',
      email: 'info@test.com',
      phone: '+54 11 1234',
      address: 'Buenos Aires',
    })
  })

  test('upserts company_contexts with structured data', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    const fd = buildFormData({
      industry: 'Retail',
      description: 'Venta de ropa',
      tone_of_voice: 'Informal',
      key_customers: '[{"name":"Pepito"}]',
      key_products: '[{"name":"Remera"}]',
      business_rules: '["No fiamos"]',
    })

    await saveCompanyContext(fd)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-123',
        basics: { industry: 'Retail', description: 'Venta de ropa', location: 'Buenos Aires' },
        key_customers: [{ name: 'Pepito' }],
        key_products: [{ name: 'Remera' }],
        business_rules: ['No fiamos'],
        tone_of_voice: 'Informal',
        updated_by: 'user-uuid-123',
      }),
      { onConflict: 'tenant_id' },
    )
  })

  test('handles tenant update error', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    mockUpdate.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ error: { message: 'violates check constraint', code: '23514' } }),
    })

    const result = await saveCompanyContext(buildFormData())

    expect(result.success).toBe(false)
    expect(result.error).toContain('violates check constraint')
    expect(result.error).toContain('23514')
  })

  test('handles company_contexts upsert error', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    mockUpsert.mockResolvedValueOnce({
      error: { message: 'invalid input syntax for type uuid', code: '22P02' },
    })

    const result = await saveCompanyContext(buildFormData())

    expect(result.success).toBe(false)
    expect(result.error).toContain('uuid')
  })

  test('parses invalid JSON gracefully (fallback to empty)', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    const fd = buildFormData({
      key_customers: 'not valid json',
      key_products: '{broken',
      business_rules: '',
    })

    const result = await saveCompanyContext(fd)

    expect(result.success).toBe(true)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        key_customers: [],
        key_products: [],
        business_rules: [],
      }),
      expect.anything(),
    )
  })

  test('looks up user UUID by email', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)

    await saveCompanyContext(buildFormData())

    expect(mockSelectUser).toHaveBeenCalled()
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ updated_by: 'user-uuid-123' }),
      expect.anything(),
    )
  })

  test('passes null updated_by when user not found', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    mockSelectUser.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    })

    const result = await saveCompanyContext(buildFormData())

    expect(result.success).toBe(true)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ updated_by: null }),
      expect.anything(),
    )
  })
})
