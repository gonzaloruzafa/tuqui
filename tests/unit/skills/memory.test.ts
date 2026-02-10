/**
 * Unit Tests for Memory Skills (recall_memory, save_memory)
 *
 * Tests user-scoped memory storage and retrieval.
 * Supabase client is mocked — no real DB calls.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// --- Mock setup ---

const mockInsert = vi.fn().mockResolvedValue({ error: null })

// Chain builder for select queries
function createSelectChain(data: any[] | null, error: any = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data, error }),
    }),
  }
}

let mockSelectData: any[] | null = []
let mockSelectError: any = null

vi.mock('@/lib/supabase/client', () => ({
  getClient: () => ({
    from: (table: string) => {
      if (table !== 'memories') throw new Error(`Unexpected table: ${table}`)

      // Build a chainable mock
      const chain: any = {}
      chain.insert = mockInsert
      chain.select = vi.fn().mockReturnValue(chain)
      chain.eq = vi.fn().mockReturnValue(chain)
      chain.ilike = vi.fn().mockReturnValue(chain)
      chain.order = vi.fn().mockReturnValue(chain)
      chain.limit = vi.fn().mockResolvedValue({
        data: mockSelectData,
        error: mockSelectError,
      })

      return chain
    },
  }),
}))

const { recallMemory } = await import('@/lib/skills/memory/recall')
const { saveMemory } = await import('@/lib/skills/memory/save')
const { createMemoryTools } = await import('@/lib/skills/memory/tools')

// --- Constants ---

const TENANT_ID = 'tenant-abc'
const USER_ID = 'user-123'
const OTHER_USER_ID = 'user-456'

// --- Tests ---

describe('Memory Skills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectData = []
    mockSelectError = null
    mockInsert.mockResolvedValue({ error: null })
  })

  describe('save_memory', () => {
    test('saves a note for the user', async () => {
      const result = await saveMemory(
        { entity_name: 'MegaCorp', entity_type: 'customer', content: 'Siempre pide factura A' },
        TENANT_ID,
        USER_ID
      )

      expect(result.saved).toBe(true)
      expect(result.message).toContain('MegaCorp')
      expect(mockInsert).toHaveBeenCalledWith({
        tenant_id: TENANT_ID,
        created_by: USER_ID,
        entity_name: 'MegaCorp',
        entity_type: 'customer',
        content: 'Siempre pide factura A',
      })
    })

    test('truncates content to 500 chars', async () => {
      const longContent = 'x'.repeat(600)
      await saveMemory(
        { entity_name: 'Test', entity_type: 'general', content: longContent },
        TENANT_ID,
        USER_ID
      )

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'x'.repeat(500),
        })
      )
    })

    test('defaults entity_type to general', async () => {
      await saveMemory(
        { entity_name: 'Nota', content: 'Algo importante' } as any,
        TENANT_ID,
        USER_ID
      )

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'general',
        })
      )
    })

    test('returns error on DB failure', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'DB error' } })

      const result = await saveMemory(
        { entity_name: 'Test', entity_type: 'general', content: 'nota' },
        TENANT_ID,
        USER_ID
      )

      expect(result.saved).toBe(false)
      expect(result.message).toContain('Error')
    })
  })

  describe('recall_memory', () => {
    test('finds notes by entity name', async () => {
      mockSelectData = [
        { entity_name: 'MegaCorp', entity_type: 'customer', content: 'Pide factura A', created_at: '2026-01-15T00:00:00Z' },
      ]

      const result = await recallMemory(
        { entity_name: 'MegaCorp' },
        TENANT_ID,
        USER_ID
      )

      expect(result.found).toBe(true)
      expect(result.notes).toHaveLength(1)
      expect(result.notes![0].content).toBe('Pide factura A')
    })

    test('returns found:false when no notes match', async () => {
      mockSelectData = []

      const result = await recallMemory(
        { entity_name: 'NonExistent' },
        TENANT_ID,
        USER_ID
      )

      expect(result.found).toBe(false)
      expect(result.notes).toBeUndefined()
    })

    test('returns found:false on DB error', async () => {
      mockSelectError = { message: 'DB error' }

      const result = await recallMemory(
        { entity_name: 'Test' },
        TENANT_ID,
        USER_ID
      )

      expect(result.found).toBe(false)
    })

    test('returns multiple notes ordered by date', async () => {
      mockSelectData = [
        { entity_name: 'MegaCorp', entity_type: 'customer', content: 'Nota reciente', created_at: '2026-02-01T00:00:00Z' },
        { entity_name: 'MegaCorp', entity_type: 'customer', content: 'Nota vieja', created_at: '2026-01-01T00:00:00Z' },
      ]

      const result = await recallMemory(
        { entity_name: 'Mega' },
        TENANT_ID,
        USER_ID
      )

      expect(result.found).toBe(true)
      expect(result.notes).toHaveLength(2)
    })
  })

  describe('createMemoryTools', () => {
    test('creates both tools with correct names', () => {
      const tools = createMemoryTools(TENANT_ID, USER_ID)

      expect(tools).toHaveProperty('recall_memory')
      expect(tools).toHaveProperty('save_memory')
      expect(tools.recall_memory.description).toContain('notas')
      expect(tools.save_memory.description).toContain('Guarda')
    })

    test('recall_memory tool has correct schema', () => {
      const tools = createMemoryTools(TENANT_ID, USER_ID)
      const schema = tools.recall_memory.parameters

      const valid = schema.safeParse({ entity_name: 'MegaCorp' })
      expect(valid.success).toBe(true)

      const invalid = schema.safeParse({})
      expect(invalid.success).toBe(false)
    })

    test('save_memory tool has correct schema', () => {
      const tools = createMemoryTools(TENANT_ID, USER_ID)
      const schema = tools.save_memory.parameters

      const valid = schema.safeParse({
        entity_name: 'MegaCorp',
        entity_type: 'customer',
        content: 'Nota test',
      })
      expect(valid.success).toBe(true)

      const invalid = schema.safeParse({ content: 'sin entity' })
      expect(invalid.success).toBe(false)
    })

    test('save_memory tool rejects invalid entity_type', () => {
      const tools = createMemoryTools(TENANT_ID, USER_ID)
      const schema = tools.save_memory.parameters

      const invalid = schema.safeParse({
        entity_name: 'Test',
        entity_type: 'invalid_type',
        content: 'nota',
      })
      expect(invalid.success).toBe(false)
    })

    test('recall_memory tool execute returns data', async () => {
      mockSelectData = [
        { entity_name: 'Test', entity_type: 'general', content: 'Nota', created_at: '2026-01-01T00:00:00Z' },
      ]

      const tools = createMemoryTools(TENANT_ID, USER_ID)
      const result = await tools.recall_memory.execute({ entity_name: 'Test' })

      expect(result).toHaveProperty('found', true)
    })

    test('save_memory tool execute saves data', async () => {
      const tools = createMemoryTools(TENANT_ID, USER_ID)
      const result = await tools.save_memory.execute({
        entity_name: 'Test',
        entity_type: 'general',
        content: 'Nota',
      })

      expect(result).toHaveProperty('saved', true)
    })
  })
})
