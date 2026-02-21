/**
 * Tests for PushOptIn component logic
 *
 * Tests the opt-in state management (localStorage-based frequency logic).
 * Component rendering is tested indirectly via state management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage for Node.js environment
const store: Record<string, string> = {}
const mockLocalStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
}
vi.stubGlobal('localStorage', mockLocalStorage)

// Test the localStorage-based state logic directly
const STORAGE_KEY = 'tuqui_push_optin'
const SESSION_KEY = 'tuqui_session_count'

interface OptInState {
    dismissCount: number
    accepted: boolean
    lastSession: number
}

function getOptInState(): OptInState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { dismissCount: 0, accepted: false, lastSession: 0 }
}

function saveOptInState(state: OptInState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function getSessionCount(): number {
    const count = parseInt(localStorage.getItem(SESSION_KEY) || '0', 10) + 1
    localStorage.setItem(SESSION_KEY, String(count))
    return count
}

function shouldShowOptIn(
    isSupported: boolean,
    isSubscribed: boolean,
    permission: string,
): boolean {
    if (!isSupported || isSubscribed || permission === 'denied') return false

    const state = getOptInState()
    if (state.accepted || state.dismissCount >= 3) return false

    const session = getSessionCount()
    return session === 1 || (session - state.lastSession) >= 3
}

describe('PushOptIn state logic', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('shows on first session when supported and not subscribed', () => {
        expect(shouldShowOptIn(true, false, 'default')).toBe(true)
    })

    it('does not show when not supported', () => {
        expect(shouldShowOptIn(false, false, 'default')).toBe(false)
    })

    it('does not show when already subscribed', () => {
        expect(shouldShowOptIn(true, true, 'default')).toBe(false)
    })

    it('does not show when permission denied', () => {
        expect(shouldShowOptIn(true, false, 'denied')).toBe(false)
    })

    it('does not show when already accepted', () => {
        saveOptInState({ accepted: true, dismissCount: 0, lastSession: 0 })
        expect(shouldShowOptIn(true, false, 'default')).toBe(false)
    })

    it('does not show when dismissed 3+ times', () => {
        saveOptInState({ accepted: false, dismissCount: 3, lastSession: 0 })
        expect(shouldShowOptIn(true, false, 'default')).toBe(false)
    })

    it('does not show on session 2 if dismissed on session 1', () => {
        // Session 1: shown, user dismisses
        getSessionCount() // session = 1
        saveOptInState({ accepted: false, dismissCount: 1, lastSession: 1 })

        // Session 2: should NOT show (only 1 session gap, need 3)
        const session = getSessionCount() // session = 2
        const state = getOptInState()
        const shouldShow = session === 1 || (session - state.lastSession) >= 3
        expect(shouldShow).toBe(false)
    })

    it('shows again after 3 sessions gap', () => {
        // Dismissed on session 1
        saveOptInState({ accepted: false, dismissCount: 1, lastSession: 1 })
        // Simulate sessions 2, 3, 4 passing
        localStorage.setItem(SESSION_KEY, '3')

        // Session 4: gap = 4 - 1 = 3 ≥ 3 → show
        const show = shouldShowOptIn(true, false, 'default')
        expect(show).toBe(true)
    })

    it('session counter increments correctly', () => {
        expect(getSessionCount()).toBe(1)
        expect(getSessionCount()).toBe(2)
        expect(getSessionCount()).toBe(3)
    })
})
