import Link from 'next/link'
import { Settings } from 'lucide-react'
import { auth } from '@/lib/auth/config'
import { UserMenu } from './UserMenu'
import { NotificationBell } from './NotificationBell'

export async function Header() {
    const session = await auth()

    return (
        <header className="w-full bg-white border-b border-adhoc-lavender/30 py-4 px-4 md:px-8 shadow-sm">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <img src="/adhoc-logo.png" alt="Adhoc" className="h-10 w-auto" />
                    <span className="hidden md:inline-block px-3 py-1 bg-adhoc-lavender/30 text-adhoc-violet rounded-full text-sm font-medium">
                        Tuqui
                    </span>
                </Link>
                <div className="flex items-center gap-4">
                    {session?.user && <NotificationBell />}
                    {session?.isAdmin && (
                        <Link
                            href="/admin"
                            className="flex items-center gap-2 px-3 py-1.5 bg-adhoc-lavender/20 hover:bg-adhoc-lavender/40 text-adhoc-violet rounded-lg transition-colors text-sm font-medium"
                        >
                            <Settings className="w-4 h-4" />
                            <span className="hidden sm:inline">Admin</span>
                        </Link>
                    )}
                    {session?.user && <UserMenu user={session.user} />}
                </div>
            </div>
        </header>
    )
}
