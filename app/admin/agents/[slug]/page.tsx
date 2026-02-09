import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot, FileText, Wrench, Brain, Lock, Pencil, Info, Database, Trash2 } from 'lucide-react'
import { getTenantClient } from '@/lib/supabase/client'
import { revalidatePath } from 'next/cache'
import { Switch } from '@/components/ui/Switch'
import { SaveButton } from '@/components/ui/SaveButton'
import { ToolWithDocs } from '@/components/admin/ToolWithDocs'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'
import { DeleteAgentButton } from './DeleteAgentButton'

async function getAgentDetails(tenantId: string, slug: string) {
    const db = await getTenantClient(tenantId)
    const { data: agent, error } = await db.from('agents').select('*').eq('tenant_id', tenantId).eq('slug', slug).single()
    if (error || !agent) return null

    // Get linked docs (use Array, not Set - Sets don't serialize in RSC)
    const { data: linkedDocs, error: docsError } = await db.from('agent_documents').select('document_id').eq('agent_id', agent.id)
    if (docsError) {
        console.error('[AgentEditor] Error fetching agent_documents:', docsError)
    }
    const linkedDocIds = linkedDocs?.map((d: any) => d.document_id) || []
    console.log('[AgentEditor] Loaded agent:', { slug, agentId: agent.id, linkedDocIds })

    // Determine tools: for base agents use tools column, for custom check agent_tools table too
    let tools = agent.tools || []
    if (!agent.master_agent_id && tools.length === 0) {
        const { data: agentTools } = await db.from('agent_tools').select('tool_slug').eq('agent_id', agent.id).eq('enabled', true)
        tools = agentTools?.map((t: any) => t.tool_slug) || []
    }

    // Check if it's a base agent (has master_agent_id)
    const isBaseAgent = !!agent.master_agent_id

    return { ...agent, linkedDocIds, tools, isBaseAgent }
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
    const isBaseAgent = formData.get('is_base_agent') === 'true'
    
    // For base agents: only update custom_instructions and docs
    // For custom agents: update everything
    const customInstructions = formData.get('custom_instructions') as string
    const systemPrompt = formData.get('system_prompt') as string
    const isActive = formData.get('is_active') === 'on'

    // Tools handling (multi-value) - only for custom agents
    const tools = formData.getAll('tools') as string[]
    
    // rag_enabled is now derived from tools - if knowledge_base is in tools, RAG is enabled
    const ragEnabled = tools.includes('knowledge_base')

    // Docs handling
    const docIds = formData.getAll('doc_ids') as string[]
    console.log('[AgentEditor] Saving:', { slug, docIds, tools, ragEnabled, isBaseAgent })

    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) return

    const db = await getTenantClient(session.tenant.id)

    // Get agent ID
    const { data: agent } = await db.from('agents').select('id, master_agent_id').eq('tenant_id', session.tenant.id).eq('slug', slug).single()
    if (!agent) return

    if (isBaseAgent) {
        // BASE AGENT: Only update custom_instructions and is_active
        await db.from('agents').update({
            custom_instructions: customInstructions,
            is_active: isActive,
            rag_enabled: ragEnabled
        }).eq('tenant_id', session.tenant.id).eq('id', agent.id)
    } else {
        // CUSTOM AGENT: Update everything
        await db.from('agents').update({
            name: name,
            system_prompt: systemPrompt,
            rag_enabled: ragEnabled,
            is_active: isActive,
            tools: tools
        }).eq('tenant_id', session.tenant.id).eq('id', agent.id)

        // Update Agent Tools table (for backward compatibility)
        await db.from('agent_tools').delete().eq('agent_id', agent.id)
        if (tools.length > 0) {
            await db.from('agent_tools').insert(
                tools.map(toolSlug => ({
                    agent_id: agent.id,
                    tool_slug: toolSlug,
                    enabled: true
                }))
            )
        }
    }

    // Update Document Links (for both base and custom)
    const { error: deleteError } = await db.from('agent_documents').delete().eq('agent_id', agent.id)
    if (deleteError) {
        console.error('[AgentEditor] Error deleting agent_documents:', deleteError)
    }
    
    if (docIds.length > 0) {
        const { data: insertedDocs, error: insertError } = await db.from('agent_documents').insert(
            docIds.map(docId => ({
                tenant_id: session.tenant!.id,
                agent_id: agent.id,
                document_id: docId
            }))
        ).select()
        
        if (insertError) {
            console.error('[AgentEditor] Error inserting agent_documents:', insertError)
        } else {
            console.log('[AgentEditor] Successfully inserted docs:', insertedDocs)
        }
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
        { slug: 'web_search', label: 'Búsqueda Web', description: 'TODO-EN-UNO: Tavily + Google Grounding (precios, noticias, info general)' },
        { slug: 'odoo_intelligent_query', label: 'Odoo ERP', description: 'Consultar ventas, contactos, productos del ERP' },
        { slug: 'knowledge_base', label: 'Base de Conocimiento', description: 'Buscar en documentos cargados (manuales, catálogos, políticas)', hasDocSelector: true }
    ]
    
    // For display purposes: if rag_enabled but knowledge_base not in tools, add it
    const displayTools = agent.rag_enabled && !agent.tools?.includes('knowledge_base')
        ? [...(agent.tools || []), 'knowledge_base']
        : agent.tools || []

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
                {/* Agent Type Badge */}
                <div className="mb-6">
                    {agent.isBaseAgent ? (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
                            <Lock className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700">Agente Base</span>
                            <span className="text-xs text-amber-500">• Sincronizado con Tuqui</span>
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
                            <Pencil className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-medium text-emerald-700">Agente Custom</span>
                            <span className="text-xs text-emerald-500">• Totalmente editable</span>
                        </div>
                    )}
                </div>

                <form action={updateAgent} className="max-w-3xl mx-auto space-y-8">
                    <input type="hidden" name="slug" value={agent.slug} />
                    <input type="hidden" name="is_base_agent" value={agent.isBaseAgent ? 'true' : 'false'} />

                    {/* Brain Config */}
                    <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-gray-50 bg-gray-50/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Brain className="w-5 h-5 text-adhoc-violet" />
                                <h2 className="text-xl font-bold text-gray-900 font-display">Configuración del Cerebro</h2>
                            </div>
                            <Switch name="is_active" defaultChecked={agent.is_active} label="Agente Activo" />
                        </div>
                        <div className="p-6 sm:p-8 space-y-6">
                            {!agent.isBaseAgent && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nombre del Agente</label>
                                    <input
                                        name="name"
                                        defaultValue={agent.name || ''}
                                        type="text"
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                    />
                                </div>
                            )}

                            {agent.isBaseAgent ? (
                                <>
                                    {/* Base Agent: Show readonly system prompt */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Prompt del Sistema</label>
                                            <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">No editable</span>
                                        </div>
                                        <div className="w-full bg-gray-100 border border-gray-200 rounded-xl p-4 font-mono text-sm text-gray-500 max-h-48 overflow-y-auto">
                                            {agent.system_prompt || 'Sin prompt configurado'}
                                        </div>
                                        <p className="text-[11px] text-gray-400 mt-2 italic flex items-center gap-1">
                                            <Lock className="w-3 h-3" />
                                            Este prompt se actualiza automáticamente desde la configuración central de Tuqui.
                                        </p>
                                    </div>

                                    {/* Custom Instructions for Base Agent */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                            Instrucciones Adicionales para tu Empresa
                                        </label>
                                        <textarea
                                            name="custom_instructions"
                                            defaultValue={agent.custom_instructions || ''}
                                            rows={6}
                                            placeholder="Ej: Somos Cedent, una empresa de equipamiento odontológico. Nuestros clientes son dentistas y clínicas. Siempre mencionar que tenemos envío gratis en CABA..."
                                            className="w-full bg-white border border-adhoc-lavender/30 rounded-xl p-4 font-mono text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all resize-none"
                                        />
                                        <p className="text-[11px] text-emerald-600 mt-2 italic flex items-center gap-1">
                                            <Pencil className="w-3 h-3" />
                                            Estas instrucciones se agregan al prompt base y personalizan el agente para tu negocio.
                                        </p>
                                    </div>
                                </>
                            ) : (
                                /* Custom Agent: Full editable prompt */
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
                            )}
                        </div>
                    </section>

                    {/* Tools Section */}
                    <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-gray-50 bg-gray-50/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wrench className="w-5 h-5 text-adhoc-violet" />
                                <h2 className="text-xl font-bold text-gray-900 font-display">Herramientas Habilitadas</h2>
                            </div>
                            {agent.isBaseAgent && (
                                <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Fijas</span>
                            )}
                        </div>
                        <div className="p-6 sm:p-8">
                            {agent.isBaseAgent ? (
                                /* Base Agent: Show tools as readonly */
                                <div className="space-y-4">
                                    {AVAILABLE_TOOLS.map(tool => (
                                        <ToolWithDocs
                                            key={tool.slug}
                                            tool={tool}
                                            isEnabled={displayTools.includes(tool.slug)}
                                            documents={allDocs}
                                            selectedDocIds={agent.linkedDocIds}
                                            isReadOnly={true}
                                        />
                                    ))}
                                    <p className="text-[10px] text-amber-600 mt-4 flex items-center gap-1">
                                        <Info className="w-3 h-3" />
                                        Las herramientas de agentes base se configuran centralmente.
                                    </p>
                                </div>
                            ) : (
                                /* Custom Agent: Editable tools */
                                <div className="space-y-4">
                                    {AVAILABLE_TOOLS.map(tool => (
                                        <ToolWithDocs
                                            key={tool.slug}
                                            tool={tool}
                                            isEnabled={displayTools.includes(tool.slug)}
                                            documents={allDocs}
                                            selectedDocIds={agent.linkedDocIds}
                                            isReadOnly={false}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Save Button - Fixed at bottom */}
                    <div className="sticky bottom-6 z-10 bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-100 shadow-lg">
                        <SaveButton fullWidth />
                    </div>
                </form>

                {/* Danger Zone - Only for custom agents */}
                {!agent.isBaseAgent && (
                    <section className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden mt-8">
                        <div className="p-6 border-b border-red-50 bg-red-50/50">
                            <div className="flex items-center gap-2">
                                <Trash2 className="w-5 h-5 text-red-600" />
                                <h2 className="text-lg font-semibold text-gray-900">Zona de Peligro</h2>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                                Eliminar este agente y todas sus conversaciones. Esta acción no se puede deshacer.
                            </p>
                        </div>
                        <div className="p-6">
                            <DeleteAgentButton agentId={agent.id} agentName={agent.name} />
                        </div>
                    </section>
                )}
            </div>

            <Footer />
        </div>
    )
}
