'use client'

import { SessionProvider } from 'next-auth/react'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { InstallPrompt } from '@/components/InstallPrompt'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ServiceWorkerRegistration />
            {children}
            <InstallPrompt />
        </SessionProvider>
    )
}
