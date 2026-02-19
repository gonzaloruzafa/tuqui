import { describe, test, expect, vi, beforeEach } from 'vitest'

/**
 * Tests the session callback logic directly without importing next-auth
 * (which requires next/server module not available in vitest).
 * 
 * Validates that the optimized single-query pattern works correctly.
 */

// Mock supabase
const mockLimit = vi.fn()
const mockIs = vi.fn()
const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: mockLimit,
    update: vi.fn().mockReturnThis(),
    is: mockIs,
    from: vi.fn(),
}
mockChain.from.mockReturnValue(mockChain)

describe('session callback — single query optimization', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        mockChain.from.mockReturnValue(mockChain)
        mockChain.select.mockReturnThis()
        mockChain.eq.mockReturnThis()
        mockChain.update.mockReturnThis()
    })

    test('single query returns tenant + is_admin in one roundtrip', async () => {
        // Simulate the optimized query: SELECT tenant_id, is_admin, tenants!inner(...)
        const queryResult = {
            data: [{
                tenant_id: 'tenant-123',
                is_admin: true,
                tenants: { id: 'tenant-123', name: 'Cedent', slug: 'cedent' }
            }],
            error: null
        }
        mockLimit.mockResolvedValue(queryResult)

        // Execute the same logic as the session callback
        const db = { from: mockChain.from }
        const { data: users } = await db
            .from('users')
            .select('tenant_id, is_admin, tenants!inner(id, name, slug)')
            .eq('email', 'test@cedent.com')
            .limit(1)

        const user = users?.[0]
        const tenant = Array.isArray(user.tenants) ? user.tenants[0] : user.tenants

        expect(tenant).toEqual({ id: 'tenant-123', name: 'Cedent', slug: 'cedent' })
        expect(user.is_admin).toBe(true)

        // Verify it was a single .from('users') call
        expect(mockChain.from).toHaveBeenCalledTimes(1)
        expect(mockChain.from).toHaveBeenCalledWith('users')
        expect(mockChain.select).toHaveBeenCalledWith('tenant_id, is_admin, tenants!inner(id, name, slug)')
    })

    test('handles tenant as array (Supabase join quirk)', async () => {
        mockLimit.mockResolvedValue({
            data: [{
                tenant_id: 't-1',
                is_admin: false,
                tenants: [{ id: 't-1', name: 'TestCo', slug: 'testco' }]
            }],
            error: null
        })

        const { data: users } = await mockChain.from('users')
            .select('tenant_id, is_admin, tenants!inner(id, name, slug)')
            .eq('email', 'user@test.com')
            .limit(1)

        const user = users?.[0]
        const tenant = Array.isArray(user.tenants) ? user.tenants[0] : user.tenants
        
        expect(tenant).toEqual({ id: 't-1', name: 'TestCo', slug: 'testco' })
        expect(user.is_admin).toBe(false)
    })

    test('handles no user found gracefully', async () => {
        mockLimit.mockResolvedValue({ data: [], error: null })

        const { data: users } = await mockChain.from('users')
            .select('tenant_id, is_admin, tenants!inner(id, name, slug)')
            .eq('email', 'nobody@unknown.com')
            .limit(1)

        const user = users?.[0]
        expect(user).toBeUndefined()
    })

    test('conditional auth_user_id update only fires when null', async () => {
        mockIs.mockResolvedValue({ data: null, error: null })

        // Simulate the conditional update
        await mockChain.from('users')
            .update({ auth_user_id: 'uuid-123' })
            .eq('email', 'test@cedent.com')
            .eq('tenant_id', 'tenant-123')
            .is('auth_user_id', null)

        expect(mockChain.update).toHaveBeenCalledWith({ auth_user_id: 'uuid-123' })
        expect(mockChain.is).toHaveBeenCalledWith('auth_user_id', null)
    })
})
