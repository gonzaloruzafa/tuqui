'use client'

import { Shield, ShieldCheck, Trash2 } from 'lucide-react'
import { updateUserRole, deleteUser } from './actions'
import { useState } from 'react'

interface User {
    id: string
    email: string
    is_admin: boolean
    role: string
    created_at: string
}

export function UserList({ initialUsers, currentUserEmail }: { initialUsers: User[], currentUserEmail: string }) {
    const [isLoading, setIsLoading] = useState<string | null>(null)

    const handleToggleAdmin = async (user: User) => {
        if (user.email === currentUserEmail) return
        setIsLoading(user.id)
        try {
            await updateUserRole(user.id, !user.is_admin)
        } catch (e) {
            alert('Error al actualizar rol')
        } finally {
            setIsLoading(null)
        }
    }

    const handleDelete = async (user: User) => {
        if (user.email === currentUserEmail) return
        if (!confirm(`¿Estás seguro de eliminar a ${user.email}?`)) return

        setIsLoading(user.id)
        try {
            await deleteUser(user.id)
        } catch (e) {
            alert('Error al eliminar usuario')
        } finally {
            setIsLoading(null)
        }
    }

    return (
        <div className="space-y-3">
            {initialUsers.map((u) => (
                <div key={u.id} className={`bg-white p-4 rounded-2xl border border-adhoc-lavender/20 shadow-sm flex items-center justify-between group hover:border-adhoc-violet/30 transition-all ${isLoading === u.id ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${u.is_admin ? 'bg-adhoc-lavender text-adhoc-violet' : 'bg-gray-100 text-gray-400'}`}>
                            {u.email[0].toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900 leading-none">{u.email}</span>
                                {u.is_admin ? (
                                    <span className="px-2 py-0.5 rounded-full bg-adhoc-lavender/40 text-adhoc-violet text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 border border-adhoc-lavender/50">
                                        <ShieldCheck className="w-2.5 h-2.5" />
                                        Admin
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 text-[9px] font-bold uppercase tracking-wider border border-gray-100">
                                        Standard
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight mt-1.5 leading-none">
                                Miembro desde {new Date(u.created_at).toLocaleDateString('es-AR')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                        <button
                            onClick={() => handleToggleAdmin(u)}
                            disabled={u.email === currentUserEmail || isLoading !== null}
                            className={`p-2 rounded-lg transition-colors ${u.is_admin ? 'text-adhoc-violet hover:bg-adhoc-lavender/30' : 'text-gray-300 hover:bg-gray-100 hover:text-adhoc-violet'}`}
                            title={u.is_admin ? "Quitar Admin" : "Hacer Admin"}
                        >
                            <Shield className="w-4 h-4" />
                        </button>

                        <button
                            onClick={() => handleDelete(u)}
                            disabled={u.email === currentUserEmail || isLoading !== null}
                            className="p-2 text-gray-300 hover:text-adhoc-coral hover:bg-adhoc-coral/5 rounded-lg transition-colors"
                            title="Eliminar Usuario"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}
