/**
 * Tests for InstallPrompt (A2HS) component logic
 *
 * Tests the localStorage-based install prompt frequency logic.
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

const STORAGE_KEY = 'tuqui_install_prompt'
const SESSION_KEY = 'tuqui_session_count'

interface InstallState {
    dismissed: boolean
    dismissCount: number
    installed: boolean
    lastSession: number
}

function getInstallState(): InstallState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { dismissed: false, dismissCount: 0, installed: false, lastSession: 0 }
}

function saveInstallState(state: InstallState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function getSessionCount(): number {
    return parseInt(localStorage.getItem(SESSION_KEY) || '1', 10)
}

function shouldShowInstall(isStandalone: boolean): boolean {
    if (isStandalone) return false

    const state = getInstallState()
    if (state.installed) return false

    const session = getSessionCount()
    return !state.dismissed || (session - state.lastSession) >= 5
}

describe('InstallPrompt state logic', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('shows when not standalone and not dismissed', () => {
        expect(shouldShowInstall(false)).toBe(true)
    })

    it('does not show when already installed (standalone)', () => {
        expect(shouldShowInstall(true)).toBe(false)
    })

    it('does not show when marked as installed in storage', () => {
        saveInstallState({ dismissed: false, dismissCount: 0, installed: true, lastSession: 0 })
        expect(shouldShowInstall(false)).toBe(false)
    })

    it('does not show immediately after dismiss', () => {
        localStorage.setItem(SESSION_KEY, '1')
        saveInstallState({ dismissed: true, dismissCount: 1, installed: false, lastSession: 1 })
        expect(shouldShowInstall(false)).toBe(false)
    })

    it('shows again 5 sessions after dismiss', () => {
        saveInstallState({ dismissed: true, dismissCount: 1, installed: false, lastSession: 1 })
        localStorage.setItem(SESSION_KEY, '6') // gap = 6 - 1 = 5

        expect(shouldShowInstall(false)).toBe(true)
    })

    it('does not show 4 sessions after dismiss', () => {
        saveInstallState({ dismissed: true, dismissCount: 1, installed: false, lastSession: 1 })
        localStorage.setItem(SESSION_KEY, '5') // gap = 5 - 1 = 4

        expect(shouldShowInstall(false)).toBe(false)
    })
})
