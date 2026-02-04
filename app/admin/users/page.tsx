import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Plus, ShieldCheck, Mail, Phone, ChevronRight, KeyRound } from 'lucide-react'
import { getClient } from '@/lib/supabase/client'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'

interface User {
    id: string
    email: string
    name: string | null
    is_admin: boolean
    whatsapp_phone: string | null
    auth_user_id: string | null
    created_at: string
}

async function getTenantUsers(tenantId: string): Promise<User[]> {
    const db = getClient()
    const { data, error } = await db
        .from('users')
        .select('id, email, name, is_admin, whatsapp_phone, auth_user_id, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching users:', error)
        return []
    }
    return data || []
}

export default async function AdminUsersPage() {
    const session = await auth()

    if (!session?.user || !session.isAdmin) {
        redirect('/')
    }

    const users = await getTenantUsers(session.tenant!.id)
    const currentUserEmail = session.user?.email || ''

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans flex flex-col">
            <Header />

            <AdminSubHeader
                title="Gestión de Usuarios"
                backHref="/admin"
                icon={Users}
                tenantName={session.tenant?.name}
            />

            <div className="flex-grow max-w-4xl mx-auto px-6 py-8 w-full">
                {/* Header with New User button */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Miembros del Equipo</h2>
                        <p className="text-sm text-gray-500">{users.length} usuario{users.length !== 1 ? 's' : ''}</p>
                    </div>
                    <Link
                        href="/admin/users/new"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-adhoc-violet text-white rounded-xl font-medium text-sm hover:bg-adhoc-violet/90 transition-all shadow-md shadow-adhoc-violet/20"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Usuario
                    </Link>
                </div>

                {/* Users Grid */}
                <div className="space-y-3">
                    {users.map((user) => (
                        <Link
                            key={user.id}
                            href={`/admin/users/${user.id}`}
                            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group hover:border-adhoc-violet/30 hover:shadow-md transition-all"
                        >
                            {/* Avatar */}
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
                                user.is_admin 
                                    ? 'bg-adhoc-lavender text-adhoc-violet' 
                                    : 'bg-gray-100 text-gray-400'
                            }`}>
                                {user.email[0].toUpperCase()}
                            </div>

                            {/* User Info */}
                            <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-gray-900 truncate">
                                        {user.name || user.email}
                                    </span>
                                    {user.is_admin && (
                                        <span className="px-2 py-0.5 rounded-full bg-adhoc-lavender/40 text-adhoc-violet text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 border border-adhoc-lavender/50 shrink-0">
                                            <ShieldCheck className="w-2.5 h-2.5" />
                                            Admin
                                        </span>
                                    )}
                                    {user.email === currentUserEmail && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase tracking-wider shrink-0">
                                            Tú
                                        </span>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                    <span className="flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5" />
                                        {user.email}
                                    </span>
                                    {user.whatsapp_phone && (
                                        <span className="flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5" />
                                            {user.whatsapp_phone}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 mt-2">
                                    {user.auth_user_id ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                            <KeyRound className="w-3 h-3" />
                                            Puede iniciar sesión
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                            Sin acceso configurado
                                        </span>
                                    )}
                                    <span className="text-[10px] text-gray-400">
                                        Desde {new Date(user.created_at).toLocaleDateString('es-AR')}
                                    </span>
                                </div>
                            </div>

                            {/* Arrow */}
                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-adhoc-violet transition-colors shrink-0" />
                        </Link>
                    ))}

                    {users.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                            <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-500">No hay usuarios en el equipo</p>
                            <Link
                                href="/admin/users/new"
                                className="inline-flex items-center gap-2 mt-4 text-adhoc-violet hover:underline text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                Agregar el primero
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <Footer />
        </div>
    )
}
