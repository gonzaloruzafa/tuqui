import { requirePlatformAdmin } from '@/lib/platform/auth'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default async function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await requirePlatformAdmin()

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans flex flex-col">
            <Header />
            {children}
            <Footer />
        </div>
    )
}
