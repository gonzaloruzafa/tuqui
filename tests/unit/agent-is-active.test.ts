/**
 * Tests for getAgentBySlug is_active guard
 * 
 * Verifies inactive agents are NOT returned by getAgentBySlug
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// --- Mock setup ---

let mockAgentData: any = null
let mockTenantData: any = null

const mockEqChain = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
    getTenantClient: vi.fn(async () => ({
        from: vi.fn((table: string) => {
            if (table === 'agents') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    single: vi.fn().mockResolvedValue(mockAgentData)
                                })
                            })
                        })
                    })
                }
            }
            if (table === 'tenants') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue(mockTenantData)
                        })
                    })
                }
            }
            // master_agents for ensureAgentsForTenant
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        order: vi.fn().mockResolvedValue({ data: [], error: null })
                    })
                })
            }
        })
    })),
    getClient: vi.fn(() => ({
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: [], error: null })
                })
            })
        })
    }))
}))

// Mock ensureAgentsForTenant to no-op
vi.mock('@/lib/agents/ensure', () => ({
    ensureAgentsForTenant: vi.fn()
}))

// ============================================

beforeEach(() => {
    vi.clearAllMocks()
    mockTenantData = { data: { name: 'TestCo' }, error: null }
})

describe('getAgentBySlug', () => {
    test('returns agent when active', async () => {
        mockAgentData = {
            data: {
                id: 'agent-1',
                slug: 'odoo',
                name: 'Odoo',
                is_active: true,
                system_prompt: 'test',
                tools: ['odoo'],
                custom_instructions: null,
                master_agent_id: null,
            },
            error: null
        }

        const { getAgentBySlug } = await import('@/lib/agents/service')
        const result = await getAgentBySlug('tenant-1', 'odoo')

        expect(result).not.toBeNull()
        expect(result?.slug).toBe('odoo')
    })

    test('returns null when agent not found (inactive filtered by DB)', async () => {
        mockAgentData = {
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' }
        }

        const { getAgentBySlug } = await import('@/lib/agents/service')
        const result = await getAgentBySlug('tenant-1', 'inactive-agent')

        expect(result).toBeNull()
    })

    test('returned agent has merged_system_prompt', async () => {
        mockAgentData = {
            data: {
                id: 'agent-2',
                slug: 'tuqui',
                name: 'Tuqui',
                is_active: true,
                system_prompt: 'Base prompt',
                tools: [],
                custom_instructions: 'Custom stuff',
                master_agent_id: 'master-1',
            },
            error: null
        }

        const { getAgentBySlug } = await import('@/lib/agents/service')
        const result = await getAgentBySlug('tenant-1', 'tuqui')

        expect(result).not.toBeNull()
        expect(result?.merged_system_prompt).toBeDefined()
        expect(result?.merged_system_prompt).toContain('Base prompt')
    })
})
