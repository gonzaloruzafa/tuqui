import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'

export default async function AdminAgentsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session?.user || !session.isAdmin) {
        redirect('/')
    }

    // Just auth check, no additional wrapper (parent already has Header)
    return <>{children}</>
}
