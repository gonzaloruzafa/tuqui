import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, ShoppingBag, Database, MessageSquare, Wrench, Search, Globe } from 'lucide-react'
import { getTenantClient } from '@/lib/supabase/tenant'
import { revalidatePath } from 'next/cache'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Switch } from '@/components/ui/Switch'

const AVAILABLE_TOOLS = [
    { 
        slug: 'odoo', 
        name: 'Odoo ERP', 
        icon: Database, 
        description: 'Conexión XML-RPC para consultas de stock, ventas y clientes.',
        configFields: [
            { name: 'odoo_url', label: 'URL de Odoo', placeholder: 'https://tu-empresa.odoo.com', type: 'text' },
            { name: 'odoo_db', label: 'Base de datos', placeholder: 'nombre-db', type: 'text' },
            { name: 'odoo_user', label: 'Usuario', placeholder: 'admin@empresa.com', type: 'text' },
            { name: 'odoo_password', label: 'API Key / Contraseña', placeholder: '••••••••', type: 'password' },
        ]
    },
    { 
        slug: 'mercadolibre', 
        name: 'MercadoLibre', 
        icon: ShoppingBag, 
        description: 'Búsqueda de productos, precios y análisis de competencia.',
        configFields: []
    },
    { 
        slug: 'whatsapp', 
        name: 'WhatsApp Business', 
        icon: MessageSquare, 
        description: 'Integración vía Twilio para respuestas automáticas.',
        configFields: []
    },
    { 
        slug: 'tavily', 
        name: 'Tavily Web Search', 
        icon: Globe, 
        description: 'Búsqueda web en tiempo real con IA.',
        configFields: [],
        envNote: 'La API Key se configura via variable de entorno TAVILY_API_KEY'
    },
]

async function getToolsConfig(tenantId: string) {
    const db = await getTenantClient(tenantId)
    // Fetch active rows from integrations table
    const { data, error } = await db.from('integrations').select('*')
    if (error && error.code !== 'PGRST116') return []
    return data || []
}

async function saveTool(formData: FormData) {
    'use server'
    const slug = formData.get('slug') as string
    const isActive = formData.get('is_active') === 'on'
    
    // Build config from form fields
    const config: Record<string, string> = {}
    const configFields = ['odoo_url', 'odoo_db', 'odoo_user', 'odoo_password']
    for (const field of configFields) {
        const value = formData.get(field) as string
        if (value) {
            config[field] = value
        }
    }

    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) return

    const db = await getTenantClient(session.tenant.id)

    // Check exist
    const { data: existing } = await db.from('integrations').select('slug, config').eq('slug', slug).single()

    if (existing) {
        // Merge config to preserve existing values if not provided
        const mergedConfig = { ...(existing.config || {}), ...config }
        await db.from('integrations').update({ is_active: isActive, config: mergedConfig }).eq('slug', slug)
    } else {
        await db.from('integrations').insert({ slug, type: slug, is_active: isActive, config })
    }

    revalidatePath('/admin/tools')
}

export default async function AdminToolsPage() {
    const session = await auth()

    if (!session?.user || !session.isAdmin) {
        redirect('/')
    }

    const activeTools = await getToolsConfig(session.tenant!.id)
    const activeMap = new Map(activeTools.map(t => [t.slug, { is_active: t.is_active, config: t.config || {} }]))

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
                        const toolData = activeMap.get(tool.slug) || { is_active: false, config: {} }
                        const isActive = toolData.is_active
                        const config = toolData.config as Record<string, string>
                        const Icon = tool.icon

                        return (
                            <form key={tool.slug} action={saveTool} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <input type="hidden" name="slug" value={tool.slug} />

                                <div className="p-6 flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                                {tool.name}
                                                {isActive && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Activo</span>}
                                            </h3>
                                            <div className="flex items-center gap-3">
                                                <Switch name="is_active" defaultChecked={isActive} label={isActive ? 'Habilitado' : 'Deshabilitado'} />
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">{tool.description}</p>
                                        
                                        {'envNote' in tool && tool.envNote && (
                                            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-3">
                                                ⚙️ {tool.envNote}
                                            </p>
                                        )}
                                        
                                        {tool.configFields && tool.configFields.length > 0 && (
                                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                {tool.configFields.map(field => (
                                                    <div key={field.name}>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                                                        <input
                                                            type={field.type}
                                                            name={field.name}
                                                            defaultValue={config[field.name] || ''}
                                                            placeholder={field.placeholder}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
                                    <button type="submit" className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                        <Save className="w-4 h-4" />
                                        Guardar
                                    </button>
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
