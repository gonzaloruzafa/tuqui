'use client'

import { PanelLeft, Settings, User } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { UserMenu } from '@/components/UserMenu'

interface ChatHeaderProps {
    onToggleSidebar: () => void
}

export function ChatHeader({ onToggleSidebar }: ChatHeaderProps) {
    const { data: session } = useSession()

    return (
        <div className="absolute top-0 left-0 right-0 z-20 h-28 bg-gradient-to-b from-white from-30% to-transparent pointer-events-none">
            <header className="h-14 flex items-center px-4 justify-between pointer-events-auto">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onToggleSidebar}
                        className="md:hidden p-2 hover:bg-adhoc-lavender/20 rounded-lg text-gray-500 hover:text-adhoc-violet transition-colors"
                    >
                        <PanelLeft className="w-5 h-5" />
                    </button>
                    <img src="/adhoc-logo.png" alt="Adhoc" className="h-7 w-auto md:hidden" />
                </div>
                <div className="flex items-center gap-2">
                    {session?.user && <UserMenu user={session.user} />}
                    {session?.isAdmin && (
                        <a
                            href="/admin"
                            className="p-2 hover:bg-adhoc-lavender/20 rounded-lg text-gray-500 hover:text-adhoc-violet transition-colors"
                            title="Configuración"
                        >
                            <Settings className="w-5 h-5" />
                        </a>
                    )}
                </div>
            </header>
        </div>
    )
}
