'use client'

/**
 * PushOptIn — Prominent push notification setup step
 *
 * Presented as part of onboarding/setup. Frequency logic:
 * - Shows immediately on first session if not subscribed
 * - If dismissed, re-shows after 7 days (weekly)
 * - Never shows again if accepted or browser denies permission
 * - No max dismiss limit — keeps asking weekly (it's key for value delivery)
 */

import { useState, useEffect, useCallback } from 'react'
import { BellRing } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { usePushNotifications } from '@/lib/hooks/use-push-notifications'

const STORAGE_KEY = 'tuqui_push_optin'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

interface OptInState {
    accepted: boolean
    lastDismissedAt: number | null // timestamp
}

function getOptInState(): OptInState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { accepted: false, lastDismissedAt: null }
}

function saveOptInState(state: OptInState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch { /* ignore */ }
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
        if (state.accepted) {
            setVisible(false)
            return
        }

        // First time: show immediately
        if (!state.lastDismissedAt) {
            setVisible(true)
            return
        }

        // Re-show after 7 days since last dismiss
        const elapsed = Date.now() - state.lastDismissedAt
        setVisible(elapsed >= SEVEN_DAYS_MS)
    }, [isSupported, isSubscribed, permission])

    const handleAccept = useCallback(async () => {
        const success = await subscribe()
        if (success) {
            saveOptInState({ accepted: true, lastDismissedAt: null })
            setVisible(false)
        }
    }, [subscribe])

    const handleDismiss = useCallback(() => {
        saveOptInState({
            ...getOptInState(),
            lastDismissedAt: Date.now(),
        })
        setVisible(false)
    }, [])

    if (!visible) return null

    return (
        <div className={`rounded-2xl bg-gradient-to-r from-adhoc-violet/10 to-adhoc-lavender/20 border border-adhoc-lavender/40 p-4 mb-3 animate-in fade-in slide-in-from-bottom-3 ${className || ''}`}>
            <div className="flex items-start gap-3">
                <div className="p-2 bg-adhoc-violet/10 rounded-xl shrink-0">
                    <BellRing className="w-5 h-5 text-adhoc-violet" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                        Completá tu configuración
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Activá las notificaciones para que Tuqui te avise cuando tenga novedades importantes.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 mt-3 ml-11">
                <button
                    onClick={handleAccept}
                    disabled={isLoading}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-adhoc-violet rounded-full hover:bg-adhoc-violet/90 disabled:opacity-50 transition-all shadow-sm"
                >
                    {isLoading ? 'Activando...' : 'Activar notificaciones'}
                </button>
                <button
                    onClick={handleDismiss}
                    className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                    Ahora no
                </button>
            </div>
        </div>
    )
}
