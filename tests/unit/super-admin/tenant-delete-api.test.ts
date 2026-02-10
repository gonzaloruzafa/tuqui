import { describe, test, expect, vi, beforeEach } from 'vitest'

// Track delete calls per table
const deleteCalls: string[] = []

const mockDeleteChain = { eq: vi.fn(() => ({ error: null })) }
const mockDeleteFn = vi.fn(() => mockDeleteChain)
const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) }))
const mockFrom = vi.fn((table: string) => {
    if (table === 'tenants' || table === 'users') {
        return { select: mockSelect, delete: () => { deleteCalls.push(table); return mockDeleteChain } }
    }
    // For cascade tables
    return { delete: () => { deleteCalls.push(table); return mockDeleteChain } }
})

const mockDeleteUser = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => ({
        from: mockFrom,
        auth: { admin: { deleteUser: mockDeleteUser } },
    }),
}))

vi.mock('@/lib/auth/config', () => ({
    auth: vi.fn().mockResolvedValue({ user: { email: 'admin@test.com' } }),
}))

vi.mock('@/lib/platform/auth', () => ({
    isPlatformAdmin: vi.fn().mockResolvedValue(true),
}))

const params = { params: Promise.resolve({ id: 'tenant-1' }) }

describe('DELETE /api/super-admin/tenants/[id] — Delete Tenant', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        deleteCalls.length = 0
    })

    test('returns 404 if tenant does not exist', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
        const { DELETE } = await import('@/app/api/super-admin/tenants/[id]/route')
        const req = new Request('http://localhost', { method: 'DELETE' })
        const res = await DELETE(req, params)
        expect(res.status).toBe(404)
    })

    test('returns 403 if not platform admin', async () => {
        const { isPlatformAdmin } = await import('@/lib/platform/auth')
        vi.mocked(isPlatformAdmin).mockResolvedValueOnce(false)
        const { DELETE } = await import('@/app/api/super-admin/tenants/[id]/route')
        const req = new Request('http://localhost', { method: 'DELETE' })
        const res = await DELETE(req, params)
        expect(res.status).toBe(403)
    })

    test('deletes auth users before DB cleanup', async () => {
        mockSingle.mockResolvedValue({ data: { id: 'tenant-1', name: 'Test' }, error: null })
        mockSelect.mockReturnValue({
            eq: vi.fn(() => ({
                single: mockSingle,
                // users query returns list
            })),
        })

        // Mock the users query to return users with auth_user_ids
        const origFrom = mockFrom
        let usersReturned = false
        mockFrom.mockImplementation((table: string): any => {
            if (table === 'users' && !usersReturned) {
                usersReturned = true
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            data: [{ auth_user_id: 'auth-1' }, { auth_user_id: 'auth-2' }],
                        })),
                    })),
                }
            }
            if (table === 'tenants') {
                return {
                    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'tenant-1', name: 'Test' }, error: null }) })) })),
                    delete: () => { deleteCalls.push(table); return mockDeleteChain },
                }
            }
            return { delete: () => { deleteCalls.push(table); return mockDeleteChain } }
        })

        const { DELETE } = await import('@/app/api/super-admin/tenants/[id]/route')
        const req = new Request('http://localhost', { method: 'DELETE' })
        await DELETE(req, params)

        expect(mockDeleteUser).toHaveBeenCalledWith('auth-1')
        expect(mockDeleteUser).toHaveBeenCalledWith('auth-2')
    })

    test('cascade deletes all required tables', async () => {
        // Reset mock to handle the full flow
        mockFrom.mockImplementation((table: string): any => {
            if (table === 'tenants') {
                return {
                    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'tenant-1', name: 'Test' }, error: null }) })) })),
                    delete: () => { deleteCalls.push(table); return mockDeleteChain },
                }
            }
            if (table === 'users') {
                return {
                    select: vi.fn(() => ({ eq: vi.fn(() => ({ data: [] })) })),
                    delete: () => { deleteCalls.push(table); return mockDeleteChain },
                }
            }
            return { delete: () => { deleteCalls.push(table); return mockDeleteChain } }
        })

        const { DELETE } = await import('@/app/api/super-admin/tenants/[id]/route')
        const req = new Request('http://localhost', { method: 'DELETE' })
        await DELETE(req, params)

        const expectedTables = [
            'conversation_messages', 'conversations', 'usage_stats',
            'documents', 'integrations', 'push_subscriptions',
            'notifications', 'users', 'agents', 'tenants',
        ]

        for (const table of expectedTables) {
            expect(deleteCalls).toContain(table)
        }
    })
})
