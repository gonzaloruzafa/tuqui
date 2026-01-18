/**
 * Unit Tests for OdooClient
 * 
 * Tests the retry logic and error handling in OdooClient.
 * These tests use mocked fetch to simulate network conditions.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the OdooClient for isolated testing
describe('OdooClient Retry Logic', () => {

    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    test('should retry on 502 gateway error', async () => {
        let attempts = 0
        const mockFetch = vi.fn().mockImplementation(() => {
            attempts++
            if (attempts < 3) {
                return Promise.resolve({
                    ok: false,
                    status: 502,
                    statusText: 'Bad Gateway'
                })
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ result: { success: true } })
            })
        })

        global.fetch = mockFetch

        // Import after mocking
        const { OdooClient } = await import('@/lib/tools/odoo/client')
        const client = new OdooClient({
            url: 'https://test.odoo.com',
            db: 'test',
            username: 'test',
            api_key: 'test-key'
        })

        // Run with advancing timers
        const resultPromise = (client as any).rpc('common', 'version')

        // Advance timers for retry delays
        await vi.advanceTimersByTimeAsync(1000)
        await vi.advanceTimersByTimeAsync(2000)

        const result = await resultPromise

        expect(attempts).toBe(3)
        expect(result).toEqual({ success: true })
    })

    test('should not retry on 400 client error', async () => {
        let attempts = 0
        const mockFetch = vi.fn().mockImplementation(() => {
            attempts++
            return Promise.resolve({
                ok: false,
                status: 400,
                statusText: 'Bad Request'
            })
        })

        global.fetch = mockFetch

        const { OdooClient } = await import('@/lib/tools/odoo/client')
        const client = new OdooClient({
            url: 'https://test.odoo.com',
            db: 'test',
            username: 'test',
            api_key: 'test-key'
        })

        await expect((client as any).rpc('common', 'version')).rejects.toThrow('Odoo HTTP Error')
        expect(attempts).toBe(1) // No retries for 400
    })

    test('should retry on network error (TypeError)', async () => {
        let attempts = 0
        const mockFetch = vi.fn().mockImplementation(() => {
            attempts++
            if (attempts < 2) {
                const error = new TypeError('Failed to fetch')
                return Promise.reject(error)
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ result: { connected: true } })
            })
        })

        global.fetch = mockFetch

        const { OdooClient } = await import('@/lib/tools/odoo/client')
        const client = new OdooClient({
            url: 'https://test.odoo.com',
            db: 'test',
            username: 'test',
            api_key: 'test-key'
        })

        const resultPromise = (client as any).rpc('common', 'version')
        await vi.advanceTimersByTimeAsync(1000)

        const result = await resultPromise

        expect(attempts).toBe(2)
        expect(result).toEqual({ connected: true })
    })
})
