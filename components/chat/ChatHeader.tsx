'use client'

import { PanelLeft, Settings } from 'lucide-react'

interface ChatHeaderProps {
    onToggleSidebar: () => void
}

export function ChatHeader({ onToggleSidebar }: ChatHeaderProps) {
    return (
        <header className="absolute top-0 left-0 right-0 h-14 flex items-center px-4 justify-between bg-white/60 backdrop-blur-md z-20 shrink-0">
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggleSidebar}
                    className="md:hidden p-2 hover:bg-adhoc-lavender/20 rounded-lg text-gray-500 hover:text-adhoc-violet transition-colors"
                >
                    <PanelLeft className="w-5 h-5" />
                </button>
                <img src="/adhoc-logo.png" alt="Adhoc" className="h-7 w-auto" />
            </div>
            <div className="flex items-center gap-2">
                <a
                    href="/admin"
                    className="p-2 hover:bg-adhoc-lavender/20 rounded-lg text-gray-500 hover:text-adhoc-violet transition-colors"
                    title="Configuración"
                >
                    <Settings className="w-5 h-5" />
                </a>
            </div>
        </header>
    )
}
