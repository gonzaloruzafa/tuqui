/**
 * Tests for lib/push/sender.ts
 *
 * sendPushToUser: sends to all user subscriptions, cleans expired
 * sendPushToTenant: sends to all tenant subscriptions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock web-push
const mockSendNotification = vi.fn()
vi.mock('web-push', () => ({
    default: {
        setVapidDetails: vi.fn(),
        sendNotification: (...args: unknown[]) => mockSendNotification(...args),
    },
}))

// Mock supabase client
const mockSelect = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
    getClient: () => ({
        from: (...args: unknown[]) => mockFrom(...args),
    }),
}))

import { sendPushToUser, sendPushToTenant } from '@/lib/push/sender'

describe('sendPushToUser', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Default chain: from().select().eq() → { data: [] }
        mockFrom.mockReturnValue({
            select: (...args: unknown[]) => {
                mockSelect(...args)
                return {
                    eq: (...eqArgs: unknown[]) => {
                        mockEq(...eqArgs)
                        return { data: [] }
                    },
                }
            },
            delete: () => ({
                eq: (...args: unknown[]) => {
                    mockDelete(...args)
                    return { data: null }
                },
            }),
        })
    })

    it('returns zeros when user has no subscriptions', async () => {
        const result = await sendPushToUser('user-1', {
            title: 'Test',
            body: 'Hello',
        })

        expect(result).toEqual({ sent: 0, failed: 0, expired: 0 })
        expect(mockSendNotification).not.toHaveBeenCalled()
    })

    it('sends to all subscriptions', async () => {
        const subs = [
            { id: 'sub-1', subscription: { endpoint: 'https://push.example.com/1', keys: { p256dh: 'a', auth: 'b' } } },
            { id: 'sub-2', subscription: { endpoint: 'https://push.example.com/2', keys: { p256dh: 'c', auth: 'd' } } },
        ]

        mockFrom.mockReturnValue({
            select: () => ({
                eq: () => ({ data: subs }),
            }),
            delete: () => ({ eq: () => ({ data: null }) }),
        })

        mockSendNotification.mockResolvedValue({})

        const result = await sendPushToUser('user-1', {
            title: 'Novedad',
            body: 'Algo interesante',
            url: '/chat/tuqui',
        })

        expect(result).toEqual({ sent: 2, failed: 0, expired: 0 })
        expect(mockSendNotification).toHaveBeenCalledTimes(2)

        // Verify payload structure
        const payload = JSON.parse(mockSendNotification.mock.calls[0][1])
        expect(payload.title).toBe('Novedad')
        expect(payload.body).toBe('Algo interesante')
        expect(payload.icon).toBe('/icons/icon-192.png')
        expect(payload.badge).toBe('/icons/badge-72.png')
        expect(payload.data.url).toBe('/chat/tuqui')
    })

    it('cleans up expired subscriptions (410)', async () => {
        const subs = [
            { id: 'sub-expired', subscription: { endpoint: 'https://push.example.com/old', keys: { p256dh: 'a', auth: 'b' } } },
        ]

        mockFrom.mockReturnValue({
            select: () => ({
                eq: () => ({ data: subs }),
            }),
            delete: () => ({
                eq: (...args: unknown[]) => {
                    mockDelete(...args)
                    return { data: null }
                },
            }),
        })

        mockSendNotification.mockRejectedValue({ statusCode: 410 })

        const result = await sendPushToUser('user-1', {
            title: 'Test',
            body: 'Hello',
        })

        expect(result).toEqual({ sent: 0, failed: 0, expired: 1 })
        expect(mockDelete).toHaveBeenCalledWith('id', 'sub-expired')
    })

    it('cleans up 404 subscriptions too', async () => {
        mockFrom.mockReturnValue({
            select: () => ({
                eq: () => ({
                    data: [{ id: 'sub-404', subscription: { endpoint: 'https://x', keys: { p256dh: 'a', auth: 'b' } } }],
                }),
            }),
            delete: () => ({ eq: (...args: unknown[]) => { mockDelete(...args); return { data: null } } }),
        })

        mockSendNotification.mockRejectedValue({ statusCode: 404 })

        const result = await sendPushToUser('user-1', { title: 'T', body: 'B' })
        expect(result.expired).toBe(1)
    })

    it('counts generic errors as failed', async () => {
        mockFrom.mockReturnValue({
            select: () => ({
                eq: () => ({
                    data: [{ id: 'sub-1', subscription: { endpoint: 'https://x', keys: { p256dh: 'a', auth: 'b' } } }],
                }),
            }),
            delete: () => ({ eq: () => ({ data: null }) }),
        })

        mockSendNotification.mockRejectedValue(new Error('Network error'))

        const result = await sendPushToUser('user-1', { title: 'T', body: 'B' })
        expect(result).toEqual({ sent: 0, failed: 1, expired: 0 })
    })

    it('uses custom icon when provided', async () => {
        mockFrom.mockReturnValue({
            select: () => ({
                eq: () => ({
                    data: [{ id: 'sub-1', subscription: { endpoint: 'https://x', keys: { p256dh: 'a', auth: 'b' } } }],
                }),
            }),
            delete: () => ({ eq: () => ({ data: null }) }),
        })
        mockSendNotification.mockResolvedValue({})

        await sendPushToUser('user-1', {
            title: 'T',
            body: 'B',
            icon: '/custom-icon.png',
        })

        const payload = JSON.parse(mockSendNotification.mock.calls[0][1])
        expect(payload.icon).toBe('/custom-icon.png')
    })
})

describe('sendPushToTenant', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns zeros when tenant has no subscriptions', async () => {
        mockFrom.mockReturnValue({
            select: () => ({
                eq: () => ({ data: [] }),
            }),
        })

        const result = await sendPushToTenant('tenant-1', {
            title: 'Test',
            body: 'Hello',
        })

        expect(result).toEqual({ sent: 0, failed: 0, expired: 0 })
    })

    it('sends to all tenant subscriptions', async () => {
        const subs = [
            { id: 'sub-1', subscription: { endpoint: 'https://a', keys: { p256dh: 'a', auth: 'b' } }, user_id: 'u1' },
            { id: 'sub-2', subscription: { endpoint: 'https://b', keys: { p256dh: 'c', auth: 'd' } }, user_id: 'u2' },
        ]

        mockFrom.mockReturnValue({
            select: () => ({
                eq: () => ({ data: subs }),
            }),
            delete: () => ({ eq: () => ({ data: null }) }),
        })

        mockSendNotification.mockResolvedValue({})

        const result = await sendPushToTenant('tenant-1', {
            title: 'Broadcast',
            body: 'For everyone',
        })

        expect(result).toEqual({ sent: 2, failed: 0, expired: 0 })
        expect(mockSendNotification).toHaveBeenCalledTimes(2)
    })
})
