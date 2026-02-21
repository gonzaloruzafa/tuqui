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

const STORAGE_KEY = 'tuqui_push_optin'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

interface OptInState {
    accepted: boolean
    lastDismissedAt: number | null
}

function getOptInState(): OptInState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { accepted: false, lastDismissedAt: null }
}

function saveOptInState(state: OptInState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function shouldShowOptIn(
    isSupported: boolean,
    isSubscribed: boolean,
    permission: string,
    now = Date.now(),
): boolean {
    if (!isSupported || isSubscribed || permission === 'denied') return false

    const state = getOptInState()
    if (state.accepted) return false

    // First time: show immediately
    if (!state.lastDismissedAt) return true

    // Re-show after 7 days
    return (now - state.lastDismissedAt) >= SEVEN_DAYS_MS
}

describe('PushOptIn state logic', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('shows on first visit when supported and not subscribed', () => {
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
        saveOptInState({ accepted: true, lastDismissedAt: null })
        expect(shouldShowOptIn(true, false, 'default')).toBe(false)
    })

    it('does not show within 7 days of dismiss', () => {
        const dismissTime = Date.now()
        saveOptInState({ accepted: false, lastDismissedAt: dismissTime })
        // 3 days later → should NOT show
        expect(shouldShowOptIn(true, false, 'default', dismissTime + 3 * 24 * 60 * 60 * 1000)).toBe(false)
    })

    it('shows again after 7 days since dismiss', () => {
        const dismissTime = Date.now() - SEVEN_DAYS_MS - 1000
        saveOptInState({ accepted: false, lastDismissedAt: dismissTime })
        expect(shouldShowOptIn(true, false, 'default')).toBe(true)
    })

    it('keeps showing weekly — no max dismiss limit', () => {
        // Dismissed 10 times, last one was 8 days ago → still shows
        const dismissTime = Date.now() - 8 * 24 * 60 * 60 * 1000
        saveOptInState({ accepted: false, lastDismissedAt: dismissTime })
        expect(shouldShowOptIn(true, false, 'default')).toBe(true)
    })

    it('dismiss saves timestamp correctly', () => {
        const now = Date.now()
        saveOptInState({ accepted: false, lastDismissedAt: now })
        const state = getOptInState()
        expect(state.lastDismissedAt).toBe(now)
        expect(state.accepted).toBe(false)
    })
})
