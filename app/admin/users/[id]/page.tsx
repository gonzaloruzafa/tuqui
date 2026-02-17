import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { User, Mail, Phone, Shield, Key, CheckCircle, Trash2 } from 'lucide-react'
import { getUserById, getUserProfileData, updateUser } from '../actions'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'
import { PasswordResetForm } from './PasswordResetForm'
import { DeleteUserButton } from './DeleteUserButton'
import { UserProfileSection } from './UserProfileSection'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await auth()
    if (!session?.user) redirect('/')

    const isAdmin = !!session.isAdmin
    const isSelf = session.user?.id === id

    // Non-admins can only view their own page
    if (!isAdmin && !isSelf) redirect('/')

    const [user, profile] = await Promise.all([
        getUserById(id),
        getUserProfileData(id),
    ])

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-adhoc-lavender/10">
            <Header />
            <AdminSubHeader 
                title={isSelf ? 'Mi Perfil' : 'Editar Usuario'}
                backHref={isAdmin ? '/admin/users' : '/admin'}
                icon={User}
            />

            <main className="flex-grow py-8 sm:py-12 px-4 sm:px-8">
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-16 h-16 bg-adhoc-violet/10 rounded-full flex items-center justify-center">
                            <span className="text-2xl font-bold text-adhoc-violet">
                                {user.email.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-grow">
                            <h1 className="text-2xl font-bold text-gray-900">
                                {profile?.display_name || user.name || user.email}
                            </h1>
                            <p className="text-gray-500">{user.email}</p>
                        </div>
                        {isSelf && (
                            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold">
                                Tu cuenta
                            </span>
                        )}
                    </div>

                    {/* SECTION: User Info (admin-only editing, read-only for non-admins) */}
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                        <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <User className="w-5 h-5 text-adhoc-violet" />
                                <h2 className="text-lg font-semibold text-gray-900">Información del Usuario</h2>
                            </div>
                        </div>
                        {isAdmin ? (
                            <form action={updateUser.bind(null, id)} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                        <Mail className="w-3.5 h-3.5 inline mr-1" />Email
                                    </label>
                                    <input type="email" value={user.email} disabled
                                        className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-500 cursor-not-allowed" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                        <User className="w-3.5 h-3.5 inline mr-1" />Nombre
                                    </label>
                                    <input type="text" name="name" defaultValue={user.name || ''} placeholder="Nombre del usuario"
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                        <Phone className="w-3.5 h-3.5 inline mr-1" />WhatsApp
                                    </label>
                                    <input type="text" name="whatsapp_phone" defaultValue={user.whatsapp_phone || ''} placeholder="+5491148999536"
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all" />
                                </div>
                                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                    <input type="checkbox" name="is_admin" id="is_admin" defaultChecked={user.is_admin}
                                        className="w-5 h-5 rounded border-gray-300 text-adhoc-violet focus:ring-adhoc-violet" />
                                    <label htmlFor="is_admin" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                        <Shield className="w-4 h-4 text-adhoc-violet" />Administrador
                                    </label>
                                </div>
                                <button type="submit" className="w-full bg-adhoc-violet text-white font-medium py-3 px-4 rounded-xl hover:bg-adhoc-violet/90 transition-colors">
                                    Guardar Cambios
                                </button>
                            </form>
                        ) : (
                            <div className="p-6 space-y-4 text-sm text-gray-600">
                                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" />{user.email}</div>
                                {user.name && <div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" />{user.name}</div>}
                                {user.whatsapp_phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" />{user.whatsapp_phone}</div>}
                                {user.is_admin && (
                                    <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-adhoc-violet" /><span className="text-adhoc-violet font-medium">Administrador</span></div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* SECTION: Profile (editable by owner or admin) */}
                    <UserProfileSection
                        userId={id}
                        profile={profile ? {
                            display_name: profile.display_name || '',
                            role_title: profile.role_title || '',
                            area: profile.area || '',
                            bio: profile.bio || '',
                            interests: profile.interests || '',
                        } : null}
                    />

                    {/* SECTION: Password (admin only, or self) */}
                    {(isAdmin || isSelf) && (
                        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                            <div className="p-6 border-b border-gray-50 bg-amber-50/50">
                                <div className="flex items-center gap-2">
                                    <Key className="w-5 h-5 text-amber-600" />
                                    <h2 className="text-lg font-semibold text-gray-900">Cambiar Contraseña</h2>
                                </div>
                            </div>
                            <PasswordResetForm userId={id} />
                        </section>
                    )}

                    {/* SECTION: Delete (admin only, not self) */}
                    {isAdmin && !isSelf && (
                        <section className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-red-50 bg-red-50/50">
                                <div className="flex items-center gap-2">
                                    <Trash2 className="w-5 h-5 text-red-600" />
                                    <h2 className="text-lg font-semibold text-gray-900">Zona de Peligro</h2>
                                </div>
                            </div>
                            <div className="p-6">
                                <DeleteUserButton userId={id} userEmail={user.email} />
                            </div>
                        </section>
                    )}

                    {/* Metadata */}
                    <div className="mt-6 text-center text-xs text-gray-400">
                        <p>Usuario creado el {new Date(user.created_at).toLocaleDateString('es-AR')}</p>
                        {user.auth_user_id && (
                            <p className="flex items-center justify-center gap-1 mt-1 text-emerald-600">
                                <CheckCircle className="w-3 h-3" />Cuenta de acceso vinculada
                            </p>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    )
}
