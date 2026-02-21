'use client'

/**
 * PushOptIn — Non-intrusive push notification opt-in banner
 *
 * Shows inline above the chat input. Frequency logic:
 * - Shows on first session if not subscribed
 * - Re-shows every 3 sessions if dismissed
 * - Never shows again if accepted or dismissed 3+ times
 * - Never shows if browser doesn't support push
 */

import { useState, useEffect, useCallback } from 'react'
import { X, Bell } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { usePushNotifications } from '@/lib/hooks/use-push-notifications'

const STORAGE_KEY = 'tuqui_push_optin'

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
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch { /* ignore */ }
}

function getSessionCount(): number {
    try {
        const key = 'tuqui_session_count'
        const count = parseInt(localStorage.getItem(key) || '0', 10) + 1
        localStorage.setItem(key, String(count))
        return count
    } catch { return 1 }
}

interface PushOptInProps {
    className?: string
}

export function PushOptIn({ className }: PushOptInProps) {
    const { data: session } = useSession()
    const tenantId = (session?.user as { tenantId?: string })?.tenantId || ''
    const { isSupported, isSubscribed, permission, subscribe, isLoading } = usePushNotifications(tenantId)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (!isSupported || isSubscribed || permission === 'denied') {
            setVisible(false)
            return
        }

        const state = getOptInState()
        if (state.accepted || state.dismissCount >= 3) {
            setVisible(false)
            return
        }

        const session = getSessionCount()
        // Show on first session, then every 3 sessions
        const shouldShow = session === 1 || (session - state.lastSession) >= 3
        setVisible(shouldShow)
    }, [isSupported, isSubscribed, permission])

    const handleAccept = useCallback(async () => {
        const success = await subscribe()
        if (success) {
            saveOptInState({ ...getOptInState(), accepted: true })
            setVisible(false)
        }
    }, [subscribe])

    const handleDismiss = useCallback(() => {
        const state = getOptInState()
        const session = getSessionCount()
        saveOptInState({
            ...state,
            dismissCount: state.dismissCount + 1,
            lastSession: session,
        })
        setVisible(false)
    }, [])

    if (!visible) return null

    return (
        <div className="flex items-center gap-3 px-4 py-2.5 mx-3 mb-2 rounded-xl bg-adhoc-lavender/20 border border-adhoc-lavender/30 animate-in fade-in slide-in-from-bottom-2">
            <Bell className="w-4 h-4 text-adhoc-violet shrink-0" />
            <p className="text-sm text-gray-700 flex-1">
                Activá notificaciones para recibir novedades
            </p>
            <button
                onClick={handleAccept}
                disabled={isLoading}
                className="text-sm font-medium text-adhoc-violet hover:text-adhoc-violet/80 disabled:opacity-50 shrink-0"
            >
                {isLoading ? 'Activando...' : 'Activar'}
            </button>
            <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-600 shrink-0"
                aria-label="Cerrar"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}
