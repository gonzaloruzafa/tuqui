import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Mail, Phone, Shield, Key, CheckCircle } from 'lucide-react'
import { getUserById, updateUser, adminSetPassword } from '../actions'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await auth()

    if (!session?.user || !session.isAdmin) {
        redirect('/')
    }

    const user = await getUserById(id)

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-adhoc-lavender/10">
            <Header />
            <AdminSubHeader 
                title="Editar Usuario"
                backHref="/admin/users"
                icon={User}
            />

            <main className="flex-grow py-8 sm:py-12 px-4 sm:px-8">
                <div className="max-w-2xl mx-auto">
                    {/* Back link */}
                    <Link 
                        href="/admin/users" 
                        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-adhoc-violet transition-colors mb-6"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver a usuarios
                    </Link>

                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-16 h-16 bg-adhoc-violet/10 rounded-full flex items-center justify-center">
                            <span className="text-2xl font-bold text-adhoc-violet">
                                {user.email.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{user.name || user.email}</h1>
                            <p className="text-gray-500">{user.email}</p>
                        </div>
                    </div>

                    {/* User Info Form */}
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                        <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <User className="w-5 h-5 text-adhoc-violet" />
                                <h2 className="text-lg font-semibold text-gray-900">Información del Usuario</h2>
                            </div>
                        </div>
                        <form action={updateUser.bind(null, id)} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                    <Mail className="w-3.5 h-3.5 inline mr-1" />
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={user.email}
                                    disabled
                                    className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-500 cursor-not-allowed"
                                />
                                <p className="text-xs text-gray-400 mt-1">El email no se puede modificar</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                    <User className="w-3.5 h-3.5 inline mr-1" />
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    defaultValue={user.name || ''}
                                    placeholder="Nombre del usuario"
                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                    <Phone className="w-3.5 h-3.5 inline mr-1" />
                                    WhatsApp
                                </label>
                                <input
                                    type="text"
                                    name="whatsapp_phone"
                                    defaultValue={user.whatsapp_phone || ''}
                                    placeholder="+5491148999536"
                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                />
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                <input
                                    type="checkbox"
                                    name="is_admin"
                                    id="is_admin"
                                    defaultChecked={user.is_admin}
                                    className="w-5 h-5 rounded border-gray-300 text-adhoc-violet focus:ring-adhoc-violet"
                                />
                                <label htmlFor="is_admin" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Shield className="w-4 h-4 text-adhoc-violet" />
                                    Administrador
                                </label>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-adhoc-violet text-white font-medium py-3 px-4 rounded-xl hover:bg-adhoc-violet/90 transition-colors"
                            >
                                Guardar Cambios
                            </button>
                        </form>
                    </section>

                    {/* Password Reset Section */}
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-50 bg-amber-50/50">
                            <div className="flex items-center gap-2">
                                <Key className="w-5 h-5 text-amber-600" />
                                <h2 className="text-lg font-semibold text-gray-900">Cambiar Contraseña</h2>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                                {user.auth_user_id 
                                    ? 'Este usuario tiene cuenta de acceso. Podés cambiar su contraseña.'
                                    : 'Este usuario aún no inició sesión. Al establecer una contraseña se creará su cuenta de acceso.'}
                            </p>
                        </div>
                        <PasswordResetForm userId={id} />
                    </section>

                    {/* Metadata */}
                    <div className="mt-6 text-center text-xs text-gray-400">
                        <p>Usuario creado el {new Date(user.created_at).toLocaleDateString('es-AR')}</p>
                        {user.auth_user_id && (
                            <p className="flex items-center justify-center gap-1 mt-1 text-emerald-600">
                                <CheckCircle className="w-3 h-3" />
                                Cuenta de acceso vinculada
                            </p>
                        )}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    )
}

// Client component for password form with validation
function PasswordResetForm({ userId }: { userId: string }) {
    return (
        <form action={adminSetPassword.bind(null, userId)} className="p-6 space-y-4">
            <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Nueva Contraseña
                </label>
                <input
                    type="password"
                    name="password"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Confirmar Contraseña
                </label>
                <input
                    type="password"
                    name="confirm_password"
                    required
                    minLength={6}
                    placeholder="Repetí la contraseña"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                />
            </div>

            <button
                type="submit"
                className="w-full bg-amber-500 text-white font-medium py-3 px-4 rounded-xl hover:bg-amber-600 transition-colors"
            >
                Establecer Contraseña
            </button>
        </form>
    )
}
