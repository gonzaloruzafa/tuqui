import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserPlus, Mail, User, Phone, Shield, Key } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'
import { createUser } from '../actions'

export default async function NewUserPage() {
    const session = await auth()

    if (!session?.user || !session.isAdmin) {
        redirect('/')
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-adhoc-lavender/10">
            <Header />
            <AdminSubHeader 
                title="Nuevo Usuario"
                backHref="/admin/users"
                icon={UserPlus}
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

                    {/* Form */}
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-adhoc-violet" />
                                <h2 className="text-lg font-semibold text-gray-900">Crear Usuario</h2>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                                Agregá un nuevo miembro al equipo
                            </p>
                        </div>
                        
                        <form action={createUser} className="p-6 space-y-5">
                            {/* Email */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                    <Mail className="w-3.5 h-3.5 inline mr-1" />
                                    Email *
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    placeholder="usuario@empresa.com"
                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                />
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                    <User className="w-3.5 h-3.5 inline mr-1" />
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    placeholder="Nombre del usuario"
                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                    <Phone className="w-3.5 h-3.5 inline mr-1" />
                                    WhatsApp
                                </label>
                                <input
                                    type="text"
                                    name="whatsapp_phone"
                                    placeholder="+5491148999536"
                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                />
                            </div>

                            {/* Admin Toggle */}
                            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                <input
                                    type="checkbox"
                                    name="is_admin"
                                    id="is_admin"
                                    className="w-5 h-5 rounded border-gray-300 text-adhoc-violet focus:ring-adhoc-violet"
                                />
                                <label htmlFor="is_admin" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Shield className="w-4 h-4 text-adhoc-violet" />
                                    Administrador
                                </label>
                            </div>

                            {/* Password Section */}
                            <div className="border-t border-gray-100 pt-5 mt-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Key className="w-4 h-4 text-amber-600" />
                                    <span className="text-sm font-medium text-gray-700">Contraseña (opcional)</span>
                                </div>
                                <p className="text-xs text-gray-500 mb-4">
                                    Si no configurás contraseña, el usuario solo podrá acceder con Google.
                                </p>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                            Contraseña
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            minLength={6}
                                            placeholder="Mínimo 6 caracteres"
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                            Confirmar
                                        </label>
                                        <input
                                            type="password"
                                            name="confirm_password"
                                            minLength={6}
                                            placeholder="Repetir contraseña"
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                className="w-full bg-adhoc-violet text-white font-medium py-3 px-4 rounded-xl hover:bg-adhoc-violet/90 transition-colors mt-6"
                            >
                                Crear Usuario
                            </button>
                        </form>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    )
}
