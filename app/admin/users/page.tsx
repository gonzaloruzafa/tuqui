import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { Users, Mail } from 'lucide-react'
import { getClient } from '@/lib/supabase/client'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'
import { addUser } from './actions'
import { UserList } from './UserList'

async function getTenantUsers(tenantId: string) {
    const db = getClient()
    const { data, error } = await db
        .from('users')
        .select('*')
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

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans flex flex-col">
            <Header />

            <AdminSubHeader
                title="Gestión de Usuarios"
                backHref="/admin"
                icon={Users}
                tenantName={session.tenant?.name}
            />

            <div className="flex-grow max-w-5xl mx-auto px-6 py-8 w-full">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Add User Sidebar */}
                    <div className="md:col-span-1">
                        <div className="bg-white rounded-2xl border border-adhoc-lavender/30 shadow-sm overflow-hidden sticky top-24">
                            <div className="p-5 border-b border-gray-100 bg-gray-50/30">
                                <h2 className="font-semibold text-gray-900 flex items-center gap-2 font-display">
                                    <Users className="w-4 h-4 text-adhoc-violet" />
                                    Invitar Usuario
                                </h2>
                            </div>
                            <div className="p-5">
                                <form action={addUser} className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                                            Email del Usuario
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                name="email"
                                                type="email"
                                                required
                                                placeholder="usuario@empresa.com"
                                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                                            Rol Inicial
                                        </label>
                                        <select
                                            name="role"
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 outline-none appearance-none"
                                        >
                                            <option value="user">Usuario Estándar</option>
                                            <option value="admin">Administrador</option>
                                        </select>
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full py-3 bg-adhoc-violet hover:bg-adhoc-violet/90 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-adhoc-violet/20 active:scale-95"
                                    >
                                        Agregar al Equipo
                                    </button>
                                </form>
                                <p className="mt-4 text-[11px] text-gray-400 leading-relaxed text-center italic">
                                    El usuario podrá ingresar con su cuenta de Google.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Users List */}
                    <div className="md:col-span-2 space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                Miembros del Equipo ({users.length})
                            </h3>
                        </div>

                        <UserList initialUsers={users} currentUserEmail={session.user?.email || ''} />
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    )
}
