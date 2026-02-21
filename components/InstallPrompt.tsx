'use client'

/**
 * InstallPrompt — A2HS (Add to Home Screen) banner
 *
 * Captures the `beforeinstallprompt` event and shows a branded
 * install banner at first login. If dismissed, re-shows every 5 sessions.
 * ChatGPT-style: subtle bottom banner, not a modal.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Download, X } from 'lucide-react'

const STORAGE_KEY = 'tuqui_install_prompt'

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
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch { /* ignore */ }
}

function getSessionCount(): number {
    try {
        return parseInt(localStorage.getItem('tuqui_session_count') || '1', 10)
    } catch { return 1 }
}

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
    const [visible, setVisible] = useState(false)
    const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

    useEffect(() => {
        // Already installed as standalone?
        if (window.matchMedia('(display-mode: standalone)').matches) {
            saveInstallState({ ...getInstallState(), installed: true })
            return
        }

        const state = getInstallState()
        if (state.installed) return

        const handler = (e: Event) => {
            e.preventDefault()
            deferredPrompt.current = e as BeforeInstallPromptEvent

            const session = getSessionCount()
            // Show on first login, then every 5 sessions after dismiss
            const shouldShow = !state.dismissed ||
                (session - state.lastSession) >= 5
            if (shouldShow) setVisible(true)
        }

        window.addEventListener('beforeinstallprompt', handler)

        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const handleInstall = useCallback(async () => {
        if (!deferredPrompt.current) return

        await deferredPrompt.current.prompt()
        const { outcome } = await deferredPrompt.current.userChoice

        if (outcome === 'accepted') {
            saveInstallState({ ...getInstallState(), installed: true })
        }
        deferredPrompt.current = null
        setVisible(false)
    }, [])

    const handleDismiss = useCallback(() => {
        const state = getInstallState()
        const session = getSessionCount()
        saveInstallState({
            ...state,
            dismissed: true,
            dismissCount: state.dismissCount + 1,
            lastSession: session,
        })
        setVisible(false)
    }, [])

    if (!visible) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-white border-t border-gray-100 shadow-lg animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-3 max-w-lg mx-auto">
                <div className="w-10 h-10 rounded-xl bg-adhoc-violet/10 flex items-center justify-center shrink-0">
                    <Download className="w-5 h-5 text-adhoc-violet" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">Instalá Tuqui</p>
                    <p className="text-xs text-gray-500">Acceso rápido desde tu pantalla de inicio</p>
                </div>
                <button
                    onClick={handleInstall}
                    className="px-4 py-2 text-sm font-medium text-white bg-adhoc-violet rounded-lg hover:bg-adhoc-violet/90 shrink-0"
                >
                    Instalar
                </button>
                <button
                    onClick={handleDismiss}
                    className="text-gray-400 hover:text-gray-600 shrink-0"
                    aria-label="Cerrar"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
