import { describe, test, expect, vi, beforeEach } from 'vitest'

// --- Supabase mock chain ---
const mockUpdateUserById = vi.fn()
const mockDeleteUser = vi.fn()
const mockAuthAdmin = { updateUserById: mockUpdateUserById, deleteUser: mockDeleteUser }

const mockSingle = vi.fn()
const mockDelete = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }))
const mockHead = vi.fn()
const mockEq3 = vi.fn(() => ({ single: mockSingle, head: mockHead, delete: mockDelete }))
const mockEq2 = vi.fn(() => ({ single: mockSingle, eq: mockEq3, delete: mockDelete }))
const mockSelect = vi.fn(() => ({ eq: mockEq2 }))
const mockFrom = vi.fn(() => ({ select: mockSelect, delete: mockDelete }))

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => ({
        from: mockFrom,
        auth: { admin: mockAuthAdmin },
    }),
}))

vi.mock('@/lib/auth/config', () => ({
    auth: vi.fn().mockResolvedValue({ user: { email: 'admin@test.com' } }),
}))

vi.mock('@/lib/platform/auth', () => ({
    isPlatformAdmin: vi.fn().mockResolvedValue(true),
}))

function makeRequest(body?: any): Request {
    return new Request('http://localhost/api/test', {
        method: body ? 'PATCH' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    })
}

const params = { params: Promise.resolve({ id: 'tenant-1', userId: 'user-1' }) }

describe('PATCH /api/super-admin/tenants/[id]/users/[userId] — Change Password', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('rejects password shorter than 6 chars', async () => {
        const { PATCH } = await import('@/app/api/super-admin/tenants/[id]/users/[userId]/route')
        const res = await PATCH(makeRequest({ password: '12345' }), params)
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toContain('6 characters')
    })

    test('rejects empty password', async () => {
        const { PATCH } = await import('@/app/api/super-admin/tenants/[id]/users/[userId]/route')
        const res = await PATCH(makeRequest({ password: '' }), params)
        expect(res.status).toBe(400)
    })

    test('returns 404 if user not in tenant', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
        const { PATCH } = await import('@/app/api/super-admin/tenants/[id]/users/[userId]/route')
        const res = await PATCH(makeRequest({ password: 'newpass123' }), params)
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error).toContain('not found')
    })

    test('returns 400 if user has no auth_user_id', async () => {
        mockSingle.mockResolvedValue({ data: { id: 'user-1', email: 'u@t.com', auth_user_id: null }, error: null })
        const { PATCH } = await import('@/app/api/super-admin/tenants/[id]/users/[userId]/route')
        const res = await PATCH(makeRequest({ password: 'newpass123' }), params)
        expect(res.status).toBe(400)
        expect((await res.json()).error).toContain('no auth account')
    })

    test('calls auth.admin.updateUserById with correct args', async () => {
        mockSingle.mockResolvedValue({ data: { id: 'user-1', email: 'u@t.com', auth_user_id: 'auth-uuid-1' }, error: null })
        mockUpdateUserById.mockResolvedValue({ error: null })
        const { PATCH } = await import('@/app/api/super-admin/tenants/[id]/users/[userId]/route')
        const res = await PATCH(makeRequest({ password: 'newpass123' }), params)
        expect(res.status).toBe(200)
        expect(mockUpdateUserById).toHaveBeenCalledWith('auth-uuid-1', { password: 'newpass123' })
    })

    test('returns 403 if not platform admin', async () => {
        const { isPlatformAdmin } = await import('@/lib/platform/auth')
        vi.mocked(isPlatformAdmin).mockResolvedValueOnce(false)
        const { PATCH } = await import('@/app/api/super-admin/tenants/[id]/users/[userId]/route')
        const res = await PATCH(makeRequest({ password: 'newpass123' }), params)
        expect(res.status).toBe(403)
    })
})

describe('DELETE /api/super-admin/tenants/[id]/users/[userId] — Delete User', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('returns 404 if user not in tenant', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
        const { DELETE } = await import('@/app/api/super-admin/tenants/[id]/users/[userId]/route')
        const res = await DELETE(makeRequest(), params)
        expect(res.status).toBe(404)
    })

    test('blocks deleting last admin', async () => {
        mockSingle.mockResolvedValue({ data: { id: 'user-1', email: 'u@t.com', auth_user_id: 'auth-1', is_admin: true }, error: null })
        mockHead.mockResolvedValue({ count: 1 })
        const { DELETE } = await import('@/app/api/super-admin/tenants/[id]/users/[userId]/route')
        const res = await DELETE(makeRequest(), params)
        expect(res.status).toBe(400)
        expect((await res.json()).error).toContain('last admin')
    })

    test('returns 403 if not platform admin', async () => {
        const { isPlatformAdmin } = await import('@/lib/platform/auth')
        vi.mocked(isPlatformAdmin).mockResolvedValueOnce(false)
        const { DELETE } = await import('@/app/api/super-admin/tenants/[id]/users/[userId]/route')
        const res = await DELETE(makeRequest(), params)
        expect(res.status).toBe(403)
    })
})
