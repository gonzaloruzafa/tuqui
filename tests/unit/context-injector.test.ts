/**
 * Unit Tests for Context Injector
 *
 * Tests the 3-source context combination:
 * 1. Tenant name/website
 * 2. Structured company_contexts (basics, web_summary, customers, products, rules, tone)
 * 3. Linked documents content
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock Supabase client
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockIn = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  getClient: () => ({ from: mockFrom })
}))

const { getCompanyContext, getCompanyContextString } = await import('@/lib/company/context-injector')

// Helper to chain supabase mocks
function mockQuery(data: any) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
      in: vi.fn().mockResolvedValue({ data }),
    }),
  }
}

describe('Context Injector', () => {
  const tenantId = 'test-tenant-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns EMPRESA from tenant name', async () => {
    let callIndex = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') {
        return mockQuery({ name: 'Adhoc SA', website: 'https://adhoc.com' })
      }
      // company_contexts — no data
      return mockQuery(null)
    })

    const result = await getCompanyContext(tenantId)

    expect(result.context).toContain('EMPRESA: Adhoc SA')
    expect(result.sources).toContain('tenant')
    expect(result.tokenEstimate).toBeGreaterThan(0)
  })

  test('includes industry and description from basics', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') {
        return mockQuery({ name: 'Adhoc SA' })
      }
      return mockQuery({
        basics: { industry: 'Tecnología', description: 'Empresa de software ERP' },
        key_customers: [],
        key_products: [],
        business_rules: [],
        tone_of_voice: null,
        web_summary: null,
        linked_documents: [],
      })
    })

    const result = await getCompanyContext(tenantId)

    expect(result.context).toContain('RUBRO: Tecnología')
    expect(result.context).toContain('DESCRIPCIÓN: Empresa de software ERP')
  })

  test('includes web_summary and adds source', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return mockQuery({ name: 'Test' })
      return mockQuery({
        basics: null,
        key_customers: [],
        key_products: [],
        business_rules: [],
        tone_of_voice: null,
        web_summary: 'Empresa argentina de tecnología fundada en 2005.',
        linked_documents: [],
      })
    })

    const result = await getCompanyContext(tenantId)

    expect(result.context).toContain('SOBRE LA EMPRESA: Empresa argentina de tecnología')
    expect(result.sources).toContain('web_scraping')
  })

  test('includes key_customers (max 5)', async () => {
    const customers = [
      { name: 'Cliente 1', notes: 'VIP' },
      { name: 'Cliente 2' },
      { name: 'Cliente 3', notes: 'Nuevo' },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return mockQuery({ name: 'Test' })
      return mockQuery({
        basics: null,
        key_customers: customers,
        key_products: [],
        business_rules: [],
        tone_of_voice: null,
        web_summary: null,
        linked_documents: [],
      })
    })

    const result = await getCompanyContext(tenantId)

    expect(result.context).toContain('CLIENTES CLAVE:')
    expect(result.context).toContain('Cliente 1 (VIP)')
    expect(result.context).toContain('Cliente 2')
    expect(result.context).toContain('Cliente 3 (Nuevo)')
    expect(result.sources).toContain('manual')
  })

  test('includes key_products (max 5)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return mockQuery({ name: 'Test' })
      return mockQuery({
        basics: null,
        key_customers: [],
        key_products: [{ name: 'Producto A', notes: '$100' }, { name: 'Producto B' }],
        business_rules: [],
        tone_of_voice: null,
        web_summary: null,
        linked_documents: [],
      })
    })

    const result = await getCompanyContext(tenantId)

    expect(result.context).toContain('PRODUCTOS CLAVE:')
    expect(result.context).toContain('Producto A ($100)')
    expect(result.context).toContain('Producto B')
  })

  test('includes business_rules (max 3)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return mockQuery({ name: 'Test' })
      return mockQuery({
        basics: null,
        key_customers: [],
        key_products: [],
        business_rules: ['Siempre cobrar IVA', 'No dar descuentos > 15%', 'Facturar antes de enviar', 'Regla extra ignorada'],
        tone_of_voice: null,
        web_summary: null,
        linked_documents: [],
      })
    })

    const result = await getCompanyContext(tenantId)

    expect(result.context).toContain('REGLAS:')
    expect(result.context).toContain('Siempre cobrar IVA')
    expect(result.context).toContain('No dar descuentos > 15%')
    expect(result.context).toContain('Facturar antes de enviar')
    // 4th rule should be cut off (max 3)
    expect(result.context).not.toContain('Regla extra ignorada')
  })

  test('includes tone_of_voice', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return mockQuery({ name: 'Test' })
      return mockQuery({
        basics: null,
        key_customers: [],
        key_products: [],
        business_rules: [],
        tone_of_voice: 'Profesional pero cercano, usar vos argentino',
        web_summary: null,
        linked_documents: [],
      })
    })

    const result = await getCompanyContext(tenantId)

    expect(result.context).toContain('TONO: Profesional pero cercano')
  })

  test('includes linked_documents content', async () => {
    const docIds = ['doc-1', 'doc-2']

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return mockQuery({ name: 'Test' })
      if (table === 'documents') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { title: 'Política', content: 'Política de devoluciones: 30 días.' },
                  { title: 'FAQ', content: 'Preguntas frecuentes sobre envíos.' },
                ],
              }),
            }),
            eq: vi.fn().mockReturnValue({
              single: vi.fn(),
            }),
          }),
        }
      }
      return mockQuery({
        basics: null,
        key_customers: [],
        key_products: [],
        business_rules: [],
        tone_of_voice: null,
        web_summary: null,
        linked_documents: docIds,
      })
    })

    const result = await getCompanyContext(tenantId)

    expect(result.context).toContain('INFO ADICIONAL:')
    expect(result.context).toContain('Política de devoluciones')
    expect(result.sources).toContain('documents')
  })

  test('returns empty context when no data exists', async () => {
    mockFrom.mockImplementation((table: string) => {
      return mockQuery(null)
    })

    const result = await getCompanyContext(tenantId)

    expect(result.context).toBe('')
    expect(result.tokenEstimate).toBe(0)
    expect(result.sources).toHaveLength(0)
  })

  test('getCompanyContextString returns only the string', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return mockQuery({ name: 'Tuqui Corp' })
      return mockQuery(null)
    })

    const contextStr = await getCompanyContextString(tenantId)

    expect(typeof contextStr).toBe('string')
    expect(contextStr).toContain('Tuqui Corp')
  })

  test('token estimate is roughly length/4', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return mockQuery({ name: 'Test' })
      return mockQuery({
        basics: { industry: 'Tech', description: 'Software company' },
        key_customers: [{ name: 'C1' }],
        key_products: [{ name: 'P1' }],
        business_rules: ['Rule 1'],
        tone_of_voice: 'Formal',
        web_summary: 'A tech company',
        linked_documents: [],
      })
    })

    const result = await getCompanyContext(tenantId)

    const expectedEstimate = Math.ceil(result.context.length / 4)
    expect(result.tokenEstimate).toBe(expectedEstimate)
  })
})
