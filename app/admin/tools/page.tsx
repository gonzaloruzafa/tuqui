import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, ShoppingBag, Database, MessageSquare, Wrench } from 'lucide-react'
import { getTenantClient } from '@/lib/supabase/tenant'
import { revalidatePath } from 'next/cache'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Switch } from '@/components/ui/Switch'

const AVAILABLE_TOOLS = [
    { slug: 'odoo', name: 'Odoo ERP', icon: Database, description: 'Conexión XML-RPC para consultas de stock, ventas y clientes.' },
    { slug: 'mercadolibre', name: 'MercadoLibre', icon: ShoppingBag, description: 'Búsqueda de productos, precios y análisis de competencia.' },
    { slug: 'whatsapp', name: 'WhatsApp Business', icon: MessageSquare, description: 'Integración vía Twilio para respuestas automáticas.' },
]

async function getToolsConfig(tenantId: string) {
    const db = await getTenantClient(tenantId)
    // Fetch active rows from integrations table
    const { data, error } = await db.from('integrations').select('*')
    if (error && error.code !== 'PGRST116') return []
    return data || []
}

async function toggleTool(formData: FormData) {
    'use server'
    const slug = formData.get('slug') as string
    const isActive = formData.get('is_active') === 'on'
    // Config fields could be added here dynamically

    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) return

    const db = await getTenantClient(session.tenant.id)

    // Check exist
    const { data: existing } = await db.from('integrations').select('slug').eq('slug', slug).single()

    if (existing) {
        await db.from('integrations').update({ is_active: isActive }).eq('slug', slug)
    } else {
        await db.from('integrations').insert({ slug, type: slug, is_active: isActive })
    }

    revalidatePath('/admin/tools')
}

export default async function AdminToolsPage() {
    const session = await auth()

    if (!session?.user || !session.isAdmin) {
        redirect('/')
    }

    const activeTools = await getToolsConfig(session.tenant!.id)
    const activeMap = new Map(activeTools.map(t => [t.slug, t.is_active]))

    return (
        <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
            <Header />

            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/admin" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-lg font-bold text-gray-900">Integraciones y Herramientas</h1>
                </div>
            </div>

            <div className="flex-grow max-w-4xl mx-auto px-6 py-8 w-full">
                <div className="grid gap-6">
                    {AVAILABLE_TOOLS.map(tool => {
                        const isActive = activeMap.get(tool.slug) || false
                        const Icon = tool.icon

                        return (
                            <form key={tool.slug} action={toggleTool} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                                <input type="hidden" name="slug" value={tool.slug} />

                                <div className="p-6 flex-1 flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                            {tool.name}
                                            {isActive && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Activo</span>}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">{tool.description}</p>
                                    </div>
                                </div>

                                <div className="p-6 bg-gray-50/50 md:bg-transparent flex items-center justify-end md:border-l border-gray-100 min-w-[200px]">
                                    <Switch name="is_active" defaultChecked={isActive} label={isActive ? 'Habilitado' : 'Deshabilitado'} />
                                    {/* Auto-submit on change workaround requires client component wrapping or pure JS. 
                                        Since Switch is client component, we can add onChange there but here we are in SC.
                                        We need to wrap this form item or make Switch accept onChange prop to form.submit()
                                     */}
                                    <button type="submit" className="ml-4 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">Guardar</button>
                                </div>
                            </form>
                        )
                    })}
                </div>
            </div>

            <Footer />
        </div>
    )
}
