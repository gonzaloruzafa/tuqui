import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Building, MapPin, Users, Package, Target, MessageSquare, Home, RefreshCw, Sparkles, FileText, ExternalLink } from 'lucide-react'
import { getMasterClient } from '@/lib/supabase/master'
import { getTenantClient } from '@/lib/supabase/tenant'
import { revalidatePath } from 'next/cache'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { generateCompanyContext } from '@/lib/company/context-generator'
import { RAGUpload } from '@/components/admin/RAGUpload'

async function getCompanyConfig(tenantId: string) {
    const db = getMasterClient()
    const { data, error } = await db
        .from('tenants')
        .select('company_name, company_cuit, company_industry, company_description, company_location, company_employees_count, company_products_services, company_target_customers, company_special_instructions, company_context, company_context_updated_at')
        .eq('id', tenantId)
        .single()
    
    if (error) {
        console.error('Error fetching company config:', error)
        return null
    }
    return data
}

async function getCompanyDocs(tenantId: string) {
    const db = await getTenantClient(tenantId)
    const { data } = await db
        .from('documents')
        .select('id, title, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
    return data || []
}

async function updateCompanyConfig(formData: FormData) {
    'use server'
    
    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) {
        throw new Error('No autorizado')
    }

    const config = {
        company_name: formData.get('company_name') as string || null,
        company_cuit: formData.get('company_cuit') as string || null,
        company_industry: formData.get('company_industry') as string || null,
        company_description: formData.get('company_description') as string || null,
        company_location: formData.get('company_location') as string || null,
        company_employees_count: formData.get('company_employees_count') as string || null,
        company_products_services: formData.get('company_products_services') as string || null,
        company_target_customers: formData.get('company_target_customers') as string || null,
        company_special_instructions: formData.get('company_special_instructions') as string || null,
    }

    // Generate context automatically
    const company_context = await generateCompanyContext(config)

    const db = getMasterClient()
    const { error } = await db
        .from('tenants')
        .update({
            ...config,
            company_context,
            company_context_updated_at: new Date().toISOString(),
        })
        .eq('id', session.tenant.id)

    if (error) {
        console.error('Error updating company config:', error)
        throw new Error('Error al guardar la configuración')
    }

    revalidatePath('/admin/company')
}

export default async function AdminCompanyPage() {
    const session = await auth()

    if (!session?.user || !session.isAdmin) {
        redirect('/')
    }

    const company = await getCompanyConfig(session.tenant!.id)
    const recentDocs = await getCompanyDocs(session.tenant!.id)

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans flex flex-col">
            <Header />

            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/admin" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                                <Building className="w-4 h-4 text-violet-600" />
                            </div>
                            <h1 className="text-lg font-bold text-gray-900">Configuración de Empresa</h1>
                        </div>
                    </div>
                    <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500" title="Ir a inicio">
                        <Home className="w-5 h-5" />
                    </Link>
                </div>
            </div>

            <div className="flex-grow max-w-4xl mx-auto px-6 py-8 w-full">
                <form action={updateCompanyConfig} className="space-y-6">
                    {/* Main Info Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                                    <Building className="w-6 h-6 text-violet-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Datos del Negocio</h2>
                                    <p className="text-sm text-gray-500">Esta información se usa para contextualizar todos los agentes IA.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Building className="w-4 h-4 inline mr-1" />
                                        Nombre de la Empresa
                                    </label>
                                    <input 
                                        name="company_name" 
                                        defaultValue={company?.company_name || ''} 
                                        type="text" 
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all" 
                                        placeholder="Ej: Adhoc Inc." 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">CUIT</label>
                                    <input 
                                        name="company_cuit" 
                                        defaultValue={company?.company_cuit || ''} 
                                        type="text" 
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all" 
                                        placeholder="Ej: 30-12345678-9" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Industria / Rubro</label>
                                    <input 
                                        name="company_industry" 
                                        defaultValue={company?.company_industry || ''} 
                                        type="text" 
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all" 
                                        placeholder="Ej: Tecnología, Retail, Servicios..." 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <MapPin className="w-4 h-4 inline mr-1" />
                                        Ubicación
                                    </label>
                                    <input 
                                        name="company_location" 
                                        defaultValue={company?.company_location || ''} 
                                        type="text" 
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all" 
                                        placeholder="Ej: CABA, Argentina" 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Descripción del Negocio</label>
                                <textarea 
                                    name="company_description" 
                                    defaultValue={company?.company_description || ''} 
                                    rows={3} 
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all resize-none" 
                                    placeholder="Describe brevemente qué hace la empresa, su misión y valores..." 
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Users className="w-4 h-4 inline mr-1" />
                                        Cantidad de Empleados
                                    </label>
                                    <select 
                                        name="company_employees_count" 
                                        defaultValue={company?.company_employees_count || ''} 
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all bg-white"
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="1-5">1-5 empleados</option>
                                        <option value="6-20">6-20 empleados</option>
                                        <option value="21-50">21-50 empleados</option>
                                        <option value="51-200">51-200 empleados</option>
                                        <option value="200+">Más de 200 empleados</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Target className="w-4 h-4 inline mr-1" />
                                        Clientes Objetivo
                                    </label>
                                    <input 
                                        name="company_target_customers" 
                                        defaultValue={company?.company_target_customers || ''} 
                                        type="text" 
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all" 
                                        placeholder="Ej: PyMEs, Consumidor final, Sector salud..." 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Package className="w-4 h-4 inline mr-1" />
                                    Productos / Servicios Principales
                                </label>
                                <textarea 
                                    name="company_products_services" 
                                    defaultValue={company?.company_products_services || ''} 
                                    rows={2} 
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all resize-none" 
                                    placeholder="Lista los principales productos o servicios que ofrece la empresa..." 
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <MessageSquare className="w-4 h-4 inline mr-1" />
                                    Instrucciones Especiales para Agentes
                                </label>
                                <textarea 
                                    name="company_special_instructions" 
                                    defaultValue={company?.company_special_instructions || ''} 
                                    rows={3} 
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all resize-none" 
                                    placeholder="Ej: Usar siempre lenguaje formal, mencionar promociones actuales, derivar consultas complejas a soporte..." 
                                />
                                <p className="text-xs text-gray-500 mt-2">Estas instrucciones se agregarán al contexto de todos los agentes.</p>
                            </div>
                        </div>
                    </div>

                    {/* Generated Context Preview */}
                    {company?.company_context && (
                        <div className="bg-violet-50 rounded-xl border border-violet-200 overflow-hidden">
                            <div className="p-4 border-b border-violet-200 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-violet-600" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-violet-900">Contexto Generado Automáticamente</h3>
                                    <p className="text-xs text-violet-600">
                                        Última actualización: {company.company_context_updated_at ? new Date(company.company_context_updated_at).toLocaleString('es-AR') : 'Nunca'}
                                    </p>
                                </div>
                            </div>
                            <div className="p-4">
                                <p className="text-sm text-violet-800 whitespace-pre-wrap">{company.company_context}</p>
                            </div>
                        </div>
                    )}

                    {/* RAG Documents Section */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <FileText className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">Documentos de la Empresa</h2>
                                        <p className="text-sm text-gray-500">Sube documentos que los agentes usarán como base de conocimiento.</p>
                                    </div>
                                </div>
                                <Link 
                                    href="/admin/rag" 
                                    className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800 font-medium"
                                >
                                    Ver todos
                                    <ExternalLink className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                        <div className="p-6">
                            <RAGUpload />
                            
                            {/* Recent docs list */}
                            {recentDocs.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="text-sm font-medium text-gray-700 mb-3">Documentos recientes</h4>
                                    <div className="space-y-2">
                                        {recentDocs.map((doc: any) => (
                                            <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                                <FileText className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-700 truncate flex-grow">
                                                    {doc.title || doc.metadata?.filename || 'Sin título'}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(doc.created_at).toLocaleDateString('es-AR')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end gap-3">
                        <Link 
                            href="/admin" 
                            className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            Cancelar
                        </Link>
                        <button 
                            type="submit" 
                            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Guardar y Regenerar Contexto
                        </button>
                    </div>
                </form>
            </div>

            <Footer />
        </div>
    )
}
