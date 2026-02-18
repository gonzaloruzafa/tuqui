'use client'

import { signOut } from 'next-auth/react'
import { LogOut, User, KeyRound } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

interface UserMenuProps {
    user: {
        name?: string | null
        email?: string | null
        image?: string | null
    }
}

export function UserMenu({ user }: UserMenuProps) {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
                {user.image ? (
                    <img src={user.image} alt="" className="w-8 h-8 rounded-full border border-gray-200" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500">
                        <User className="w-5 h-5" />
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-50 mb-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user.name || 'Usuario'}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>

                    <Link
                        href="/admin/user"
                        onClick={() => setIsOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <User className="w-4 h-4" />
                        Mi Perfil
                    </Link>

                    <Link
                        href="/admin/user"
                        onClick={() => setIsOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <KeyRound className="w-4 h-4" />
                        Cambiar Contraseña
                    </Link>

                    <div className="border-t border-gray-50 mt-1 pt-1">
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
