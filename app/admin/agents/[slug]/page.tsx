import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot, FileText, Wrench, Brain } from 'lucide-react'
import { getTenantClient } from '@/lib/supabase/client'
import { revalidatePath } from 'next/cache'
import { Switch } from '@/components/ui/Switch'
import { SaveButton } from '@/components/ui/SaveButton'
import { DocumentSelector } from '@/components/ui/DocumentSelector'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'

async function getAgentDetails(tenantId: string, slug: string) {
    const db = await getTenantClient(tenantId)
    const { data: agent, error } = await db.from('agents').select('*').eq('slug', slug).single()
    if (error || !agent) return null

    // Get linked docs
    const { data: linkedDocs } = await db.from('agent_documents').select('document_id').eq('agent_id', agent.id)
    const linkedDocIds = new Set(linkedDocs?.map((d: any) => d.document_id) || [])

    // Get tools from agent_tools table
    const { data: agentTools } = await db.from('agent_tools').select('tool_slug').eq('agent_id', agent.id).eq('enabled', true)
    const tools = agentTools?.map((t: any) => t.tool_slug) || []

    return { ...agent, linkedDocIds, tools }
}

async function getAllDocs(tenantId: string) {
    const db = await getTenantClient(tenantId)
    const { data } = await db.from('documents').select('id, title, metadata').order('created_at', { ascending: false })
    return data || []
}

async function updateAgent(formData: FormData) {
    'use server'
    const slug = formData.get('slug') as string
    const name = formData.get('name') as string
    const systemPrompt = formData.get('system_prompt') as string
    const ragEnabled = formData.get('rag_enabled') === 'on'
    const isActive = formData.get('is_active') === 'on'

    // Tools handling (multi-value)
    const tools = formData.getAll('tools') as string[]

    // Docs handling
    const docIds = formData.getAll('doc_ids') as string[]

    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) return

    const db = await getTenantClient(session.tenant.id)

    // Get agent ID
    const { data: agent } = await db.from('agents').select('id').eq('slug', slug).single()
    if (!agent) return

    // Update Agent Main Fields (without tools column - use agent_tools table)
    await db.from('agents').update({
        name: name,
        system_prompt: systemPrompt,
        rag_enabled: ragEnabled,
        is_active: isActive
    }).eq('id', agent.id)

    // Update Agent Tools (Resync)
    // 1. Delete all current tools
    await db.from('agent_tools').delete().eq('agent_id', agent.id)

    // 2. Insert new ones
    if (tools.length > 0) {
        await db.from('agent_tools').insert(
            tools.map(toolSlug => ({
                agent_id: agent.id,
                tool_slug: toolSlug,
                enabled: true
            }))
        )
    }

    // Update Document Links (Resync)
    // 1. Delete all current links
    await db.from('agent_documents').delete().eq('agent_id', agent.id)

    // 2. Insert new ones
    if (docIds.length > 0) {
        await db.from('agent_documents').insert(
            docIds.map(docId => ({
                agent_id: agent.id,
                document_id: docId
            }))
        )
    }

    revalidatePath(`/admin/agents/${slug}`)
    revalidatePath('/admin/agents')
}

export default async function AgentEditorPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const session = await auth()

    if (!session?.user || !session.isAdmin) {
        redirect('/')
    }

    const agent = await getAgentDetails(session.tenant!.id, slug)
    if (!agent) redirect('/admin/agents')

    const allDocs = await getAllDocs(session.tenant!.id)

    const AVAILABLE_TOOLS = [
        { slug: 'tavily', label: 'Navegador Web', description: 'Buscar información actualizada en internet' },
        { slug: 'firecrawl', label: 'Investigador Web', description: 'Extraer contenido de páginas específicas (artículos, precios, docs)' },
        { slug: 'odoo', label: 'Odoo ERP', description: 'Consultar ventas, contactos, productos del ERP' }
    ]

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans flex flex-col">
            <Header />

            <AdminSubHeader
                title={agent.name}
                backHref="/admin/agents"
                icon={Bot}
                tenantName={session.tenant?.name}
            />

            <div className="flex-grow max-w-5xl mx-auto px-6 py-10 w-full">
                <form action={updateAgent} className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <input type="hidden" name="slug" value={agent.slug} />

                    <div className="lg:col-span-2 space-y-10">
                        {/* Brain Config */}
                        <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-50 bg-gray-50/20 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Brain className="w-5 h-5 text-adhoc-violet" />
                                    <h2 className="text-xl font-bold text-gray-900 font-display">Configuración del Cerebro</h2>
                                </div>
                                <Switch name="is_active" defaultChecked={agent.is_active} label="Agente Activo" />
                            </div>
                            <div className="p-8 space-y-6">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nombre del Agente</label>
                                    <input
                                        name="name"
                                        defaultValue={agent.name || ''}
                                        type="text"
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Prompt del Sistema</label>
                                    <textarea
                                        name="system_prompt"
                                        defaultValue={agent.system_prompt || ''}
                                        rows={10}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 font-mono text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all resize-none"
                                    />
                                    <p className="text-[11px] text-gray-400 mt-2 italic">Instrucciones base que definen la personalidad y límites del agente.</p>
                                </div>
                            </div>
                        </section>

                        {/* RAG Config */}
                        <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-100 bg-gray-50/20 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-adhoc-violet" />
                                    <h2 className="text-xl font-bold text-gray-900 font-display">Base de Conocimiento (RAG)</h2>
                                </div>
                                <Switch name="rag_enabled" defaultChecked={agent.rag_enabled} label="Habilitar RAG" />
                            </div>
                            <div className="p-8">
                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Documentos Vinculados</h3>
                                <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-4">
                                    <DocumentSelector
                                        documents={allDocs}
                                        selectedIds={agent.linkedDocIds}
                                    />
                                </div>
                                <p className="text-[11px] text-gray-400 mt-4 italic">El agente consultará estos documentos antes de responder.</p>
                            </div>
                        </section>
                    </div>

                    {/* Sidebar / Tools */}
                    <div className="space-y-6">
                        <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden p-8">
                            <h2 className="text-lg font-bold text-gray-900 font-display flex items-center gap-2 mb-6">
                                <Wrench className="w-4 h-4 text-adhoc-violet" />
                                Herramientas Habilitadas
                            </h2>
                            <div className="space-y-3">
                                {AVAILABLE_TOOLS.map(tool => (
                                    <div key={tool.slug} className="group p-4 bg-gray-50 hover:bg-adhoc-lavender/10 border border-gray-100 rounded-2xl transition-all duration-300">
                                        <Switch
                                            name="tools"
                                            value={tool.slug}
                                            defaultChecked={agent.tools?.includes(tool.slug)}
                                            label={tool.label}
                                        />
                                        <p className="text-[10px] text-gray-400 mt-2 pl-12 leading-tight">{tool.description}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="sticky top-24">
                            <SaveButton />
                        </div>
                    </div>

                </form>
            </div>

            <Footer />
        </div>
    )
}
