import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock supabase
const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  getTenantClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      mockFrom(table)
      return {
        select: (...args: any[]) => {
          mockSelect(...args)
          return {
            eq: (...eqArgs: any[]) => {
              mockEq(...eqArgs)
              return {
                eq: (...eqArgs2: any[]) => {
                  mockEq(...eqArgs2)
                  return { single: mockSingle }
                }
              }
            }
          }
        }
      }
    }
  }),
  getClient: vi.fn().mockReturnValue({
    from: (table: string) => {
      mockFrom(table)
      return {
        select: (...args: any[]) => {
          mockSelect(...args)
          return {
            eq: (...eqArgs: any[]) => {
              mockEq(...eqArgs)
              return {
                data: [
                  {
                    master_documents: {
                      id: 'doc-1',
                      title: 'Ley de Sociedades 19.550',
                      file_name: 'ley-sociedades.pdf',
                      source_type: 'file',
                      created_at: '2026-01-01T00:00:00Z'
                    }
                  },
                  {
                    master_documents: {
                      id: 'doc-2',
                      title: 'Código Civil y Comercial',
                      file_name: 'ccyc.pdf',
                      source_type: 'file',
                      created_at: '2026-01-02T00:00:00Z'
                    }
                  }
                ],
                error: null
              }
            }
          }
        }
      }
    }
  })
}))

import { getInheritedDocuments } from '@/lib/rag/inherited-documents'

describe('getInheritedDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns inherited docs when agent has master_agent_id', async () => {
    mockSingle.mockResolvedValue({
      data: { master_agent_id: 'master-abc' },
      error: null
    })

    const docs = await getInheritedDocuments('tenant-1', 'agent-1')

    expect(docs).toHaveLength(2)
    expect(docs[0].title).toBe('Ley de Sociedades 19.550')
    expect(docs[1].title).toBe('Código Civil y Comercial')
  })

  test('returns empty array when agent has no master_agent_id', async () => {
    mockSingle.mockResolvedValue({
      data: { master_agent_id: null },
      error: null
    })

    const docs = await getInheritedDocuments('tenant-1', 'agent-1')
    expect(docs).toEqual([])
  })

  test('returns empty array when agent not found', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'not found' }
    })

    const docs = await getInheritedDocuments('tenant-1', 'nonexistent')
    expect(docs).toEqual([])
  })
})
