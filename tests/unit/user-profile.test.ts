/**
 * Tests for user profile CRUD + memory sync
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpsert = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  getClient: () => ({
    from: mockFrom,
  }),
}))

// Chain builder
function chainBuilder(finalData: unknown = null, finalError: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.upsert = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.is = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data: finalData, error: finalError })
  return chain
}

import { getUserProfile, saveUserProfile, getUserContextTag } from '@/lib/user/profile'

describe('getUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns profile when exists', async () => {
    const profile = {
      id: '1', user_id: 'u1', tenant_id: 't1',
      display_name: 'Gonzalo', role_title: 'Director',
      area: 'Ventas', bio: 'Test bio',
    }
    const chain = chainBuilder(profile)
    mockFrom.mockReturnValue(chain)

    const result = await getUserProfile('t1', 'u1')
    expect(result).toEqual(profile)
    expect(mockFrom).toHaveBeenCalledWith('user_profiles')
  })

  it('returns null when not found', async () => {
    const chain = chainBuilder(null)
    mockFrom.mockReturnValue(chain)

    const result = await getUserProfile('t1', 'u1')
    expect(result).toBeNull()
  })
})

describe('getUserContextTag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns tag with name + role + area', async () => {
    const profile = {
      display_name: 'Gonzalo', role_title: 'Director Comercial',
      area: 'Ventas', bio: 'algo',
    }
    const chain = chainBuilder(profile)
    mockFrom.mockReturnValue(chain)

    const tag = await getUserContextTag('t1', 'u1')
    expect(tag).toBe('[Usuario: Gonzalo | Director Comercial | Ventas]')
  })

  it('returns tag with partial data', async () => {
    const profile = {
      display_name: 'Ana', role_title: null,
      area: 'Admin', bio: null,
    }
    const chain = chainBuilder(profile)
    mockFrom.mockReturnValue(chain)

    const tag = await getUserContextTag('t1', 'u1')
    expect(tag).toBe('[Usuario: Ana | Admin]')
  })

  it('returns null when no profile', async () => {
    const chain = chainBuilder(null)
    mockFrom.mockReturnValue(chain)

    const tag = await getUserContextTag('t1', 'u1')
    expect(tag).toBeNull()
  })

  it('returns null when profile has no data', async () => {
    const profile = {
      display_name: null, role_title: null,
      area: null, bio: null,
    }
    const chain = chainBuilder(profile)
    mockFrom.mockReturnValue(chain)

    const tag = await getUserContextTag('t1', 'u1')
    expect(tag).toBeNull()
  })
})

describe('saveUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('upserts profile and syncs bio to memory', async () => {
    const saved = {
      id: '1', user_id: 'u1', tenant_id: 't1',
      display_name: 'Gonzalo', role_title: 'Director',
      area: 'Ventas', bio: 'Me interesa rentabilidad',
    }
    // First call: upsert user_profiles
    const upsertChain = chainBuilder(saved)
    // Second call: delete old memory
    const deleteChain = chainBuilder()
    // Third call: insert new memory
    const insertChain = chainBuilder()

    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_profiles') return upsertChain
      if (table === 'memories') {
        callCount++
        return callCount === 1 ? deleteChain : insertChain
      }
      return chainBuilder()
    })

    const result = await saveUserProfile('t1', 'u1', {
      display_name: 'Gonzalo',
      role_title: 'Director',
      area: 'Ventas',
      bio: 'Me interesa rentabilidad',
    })

    expect(result).toEqual(saved)
    expect(mockFrom).toHaveBeenCalledWith('user_profiles')
    expect(mockFrom).toHaveBeenCalledWith('memories')
  })
})
