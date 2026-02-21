'use client'

/**
 * ServiceWorkerRegistration — Eager SW registration
 *
 * Registers the service worker on app mount, ensuring push
 * notifications work even before the user interacts with PushOptIn.
 * Renders nothing — pure side-effect component.
 */

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.error('[SW] Registration failed:', err)
            })
        }
    }, [])

    return null
}
