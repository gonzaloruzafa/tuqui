import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { Building, Globe, Mail, MapPin, Phone, Save, FileText, Database } from 'lucide-react'
import { getMasterClient } from '@/lib/supabase/master'
import { getTenantClient } from '@/lib/supabase/tenant'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'
import { revalidatePath } from 'next/cache'

async function getTenantData(tenantId: string) {
    const db = getMasterClient()
    const { data, error } = await db
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single()

    if (error) {
        console.error('Error fetching tenant:', error)
        return null
    }
    return data
}

async function getRecentDocuments(tenantId: string) {
    try {
        const db = await getTenantClient(tenantId)
        const { data } = await db.from('documents').select('*').limit(5).order('created_at', { ascending: false })
        return data || []
    } catch (e) {
        return []
    }
}

async function updateCompany(formData: FormData) {
    'use server'
    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) return

    const name = formData.get('name') as string
    const website = formData.get('website') as string
    const email = formData.get('email') as string
    const phone = formData.get('phone') as string
    const address = formData.get('address') as string

    const db = getMasterClient()
    await db
        .from('tenants')
        .update({ name, website, email, phone, address })
        .eq('id', session.tenant.id)

    revalidatePath('/admin/company')
}

export default async function AdminCompanyPage() {
    const session = await auth()

    if (!session?.user || !session.isAdmin) {
        redirect('/')
    }

    const tenant = await getTenantData(session.tenant!.id)
    const recentDocs = await getRecentDocuments(session.tenant!.id)

    if (!tenant) return <div>Error: No se encontró la empresa.</div>

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans flex flex-col">
            <Header />

            <AdminSubHeader
                title="Configuración de Empresa"
                backHref="/admin"
                icon={Building}
                tenantName={tenant.name}
            />

            <div className="flex-grow max-w-5xl mx-auto px-6 py-10 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

                    {/* Main Form */}
                    <div className="lg:col-span-2 space-y-8">
                        <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-50 bg-gray-50/20">
                                <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
                                    <Building className="w-5 h-5 text-adhoc-violet" />
                                    Perfil de la Empresa
                                </h1>
                                <p className="text-sm text-gray-500 mt-1 italic">
                                    Esta información ayuda a los agentes a entender mejor tu marca.
                                </p>
                            </div>

                            <form action={updateCompany} className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                            Nombre Comercial
                                        </label>
                                        <div className="relative">
                                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                            <input
                                                name="name"
                                                defaultValue={tenant.name || ''}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                            Sitio Web
                                        </label>
                                        <div className="relative">
                                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                            <input
                                                name="website"
                                                type="url"
                                                defaultValue={tenant.website || ''}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                            Email de Contacto
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                            <input
                                                name="email"
                                                type="email"
                                                defaultValue={tenant.email || ''}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                            Teléfono
                                        </label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                            <input
                                                name="phone"
                                                defaultValue={tenant.phone || ''}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                            Dirección Principal
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                            <input
                                                name="address"
                                                defaultValue={tenant.address || ''}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button
                                        type="submit"
                                        className="flex items-center gap-2 bg-adhoc-violet hover:bg-adhoc-violet/90 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-md shadow-adhoc-violet/20 active:scale-95"
                                    >
                                        <Save className="w-4 h-4" />
                                        Guardar Cambios
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>

                    {/* Sidebar Info */}
                    <div className="space-y-6">
                        <section className="bg-white p-8 rounded-3xl border border-adhoc-lavender/30 shadow-sm">
                            <h2 className="font-bold text-gray-900 mb-6 font-display flex items-center gap-2">
                                <Database className="w-4 h-4 text-adhoc-violet" />
                                Status de Datos
                            </h2>

                            <div className="space-y-4">
                                <div className="p-4 bg-adhoc-lavender/10 rounded-2xl border border-adhoc-lavender/20">
                                    <div className="text-[10px] font-bold text-adhoc-violet uppercase tracking-widest mb-1">Empresa ID</div>
                                    <div className="text-[11px] font-mono text-gray-500 break-all">{tenant.id}</div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Plan Actual</div>
                                    <div className="text-sm font-semibold text-gray-700">Alpha Developer</div>
                                </div>
                            </div>
                        </section>

                        <section className="bg-white p-8 rounded-3xl border border-adhoc-lavender/30 shadow-sm">
                            <h2 className="font-bold text-gray-900 mb-6 font-display flex items-center gap-2">
                                <FileText className="w-4 h-4 text-adhoc-violet" />
                                Documentos Recientes
                            </h2>

                            <div className="space-y-3">
                                {recentDocs.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic text-center py-4">No hay documentos indexados.</p>
                                ) : (
                                    recentDocs.map((doc: any) => (
                                        <div key={doc.id} className="flex items-center gap-3 p-2 hover:bg-adhoc-lavender/10 rounded-xl transition-colors group cursor-default">
                                            <div className="w-8 h-8 rounded-lg bg-adhoc-lavender/20 flex items-center justify-center text-adhoc-violet">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-semibold text-gray-800 truncate">{(doc.metadata as any)?.filename || 'Doc'}</div>
                                                <div className="text-[9px] text-gray-400 uppercase font-bold tracking-tight">{new Date(doc.created_at).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    )
}
