'use client'

import { useState, useEffect } from 'react'
import { Brain, Plus, Sparkles, X, Loader2, Lock, Pencil, BookOpen, Globe, Database, ChevronRight } from 'lucide-react'
import { AdminSubHeader } from '@/components/admin/AdminSubHeader'

interface Agent {
    id: string
    name: string
    slug: string
    description: string | null
    system_prompt: string | null
    rag_enabled: boolean
    is_active: boolean
    tools: string[]
    master_agent_id: string | null
}

// Tool display config
const TOOL_DISPLAY: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    'web_search': { icon: <Globe className="w-3.5 h-3.5" />, label: 'Web', color: 'bg-blue-100 text-blue-700' },
    'odoo_intelligent_query': { icon: <Database className="w-3.5 h-3.5" />, label: 'Odoo', color: 'bg-orange-100 text-orange-700' },
    'rag': { icon: <BookOpen className="w-3.5 h-3.5" />, label: 'Base de conocimiento', color: 'bg-purple-100 text-purple-700' },
}

export default function AdminAgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [creating, setCreating] = useState(false)
    const [tenantName, setTenantName] = useState<string>('')
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        systemPrompt: '',
        ragEnabled: true,
        tools: ['web_search'] as string[]
    })

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/admin/agents')
            if (res.ok) {
                const data = await res.json()
                setAgents(data.agents || [])
                setTenantName(data.tenantName || '')
            }
        } catch (err) {
            console.error('Error fetching agents:', err)
        } finally {
            setLoading(false)
        }
    }

    const createAgent = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)

        try {
            const res = await fetch('/api/admin/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                setShowModal(false)
                setFormData({ name: '', description: '', systemPrompt: '', ragEnabled: true, tools: ['web_search'] })
                fetchAgents()
            } else {
                const data = await res.json()
                alert('Error al crear agente: ' + data.error)
            }
        } catch (error) {
            console.error('Error creating agent:', error)
            alert('Error al crear agente')
        } finally {
            setCreating(false)
        }
    }

    const toggleTool = (tool: string) => {
        setFormData(prev => ({
            ...prev,
            tools: prev.tools.includes(tool) ? prev.tools.filter(t => t !== tool) : [...prev.tools, tool]
        }))
    }

    useEffect(() => { fetchAgents() }, [])

    const availableTools = [
        { id: 'web_search', name: 'Búsqueda Web', icon: '🌐', description: 'Tavily + Google Grounding' },
        { id: 'odoo_intelligent_query', name: 'Odoo ERP', icon: '📊', description: 'Consultar datos del ERP' },
    ]

    // Separate agents by type
    const baseAgents = agents.filter(a => !!a.master_agent_id)
    const customAgents = agents.filter(a => !a.master_agent_id)

    const getAgentTools = (agent: Agent): string[] => {
        const tools = [...(agent.tools || [])]
        if (agent.rag_enabled) tools.push('rag')
        return tools
    }

    const AgentRow = ({ agent }: { agent: Agent }) => {
        const isBaseAgent = !!agent.master_agent_id
        const tools = getAgentTools(agent)

        return (
            <a
                href={`/admin/agents/${agent.slug}`}
                className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-adhoc-violet/30 hover:shadow-md transition-all duration-200"
            >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isBaseAgent ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                    <Brain className={`w-5 h-5 ${isBaseAgent ? 'text-amber-600' : 'text-emerald-600'}`} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{agent.name}</h3>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${agent.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {agent.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5">{agent.description || 'Sin descripción'}</p>
                </div>

                <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                    {tools.map(toolId => {
                        const tool = TOOL_DISPLAY[toolId]
                        if (!tool) return null
                        return (
                            <span key={toolId} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${tool.color}`} title={tool.label}>
                                {tool.icon}
                                <span className="hidden lg:inline">{tool.label}</span>
                            </span>
                        )
                    })}
                    {tools.length === 0 && <span className="text-xs text-gray-400">Sin herramientas</span>}
                </div>

                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-adhoc-violet group-hover:translate-x-1 transition-all flex-shrink-0" />
            </a>
        )
    }

    return (
        <>
            <AdminSubHeader title="Agentes" backHref="/admin" icon={Brain} tenantName={tenantName} />

            <div className="flex-grow max-w-4xl mx-auto px-6 py-10 w-full">
                <div className="mb-8 p-4 bg-adhoc-lavender/20 rounded-xl border border-adhoc-lavender/30">
                    <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-adhoc-violet mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-gray-900">Agentes internos</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Cada agente tiene su propio prompt, base de conocimiento y herramientas. 
                                Tuqui decide automáticamente cuál usar según la consulta del usuario.
                            </p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-adhoc-violet" /></div>
                ) : (
                    <div className="space-y-8">
                        {baseAgents.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Lock className="w-4 h-4 text-amber-600" />
                                    <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">Agentes Base ({baseAgents.length})</h2>
                                </div>
                                <p className="text-xs text-gray-500 mb-4">Agentes pre-configurados con capacidades especializadas. Solo podés personalizar el prompt.</p>
                                <div className="space-y-2">{baseAgents.map(agent => <AgentRow key={agent.id} agent={agent} />)}</div>
                            </div>
                        )}

                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Pencil className="w-4 h-4 text-emerald-600" />
                                <h2 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Agentes Personalizados ({customAgents.length})</h2>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">Agentes creados por vos con configuración completa.</p>
                            <div className="space-y-2">
                                {customAgents.map(agent => <AgentRow key={agent.id} agent={agent} />)}
                                <button 
                                    onClick={() => setShowModal(true)}
                                    className="w-full border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center justify-center gap-3 text-gray-400 hover:border-adhoc-violet hover:text-adhoc-violet hover:bg-adhoc-lavender/5 transition-all duration-200 group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-adhoc-violet group-hover:text-white transition-all">
                                        <Plus className="w-4 h-4" />
                                    </div>
                                    <span className="font-medium text-sm">Crear nuevo agente</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold font-display">Crear Nuevo Agente</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                        </div>

                        <form onSubmit={createAgent} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-700">Nombre del Agente *</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-adhoc-violet focus:border-transparent" placeholder="Ej: Asistente de Ventas" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-700">Descripción</label>
                                <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-adhoc-violet focus:border-transparent" placeholder="Breve descripción del agente" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-700">System Prompt</label>
                                <textarea value={formData.systemPrompt} onChange={e => setFormData({ ...formData, systemPrompt: e.target.value })} rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-adhoc-violet focus:border-transparent resize-none" placeholder="Instrucciones específicas para este agente..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-3 text-gray-700">Herramientas</label>
                                <div className="space-y-2">
                                    {availableTools.map(tool => (
                                        <label key={tool.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-adhoc-lavender cursor-pointer transition-colors">
                                            <input type="checkbox" checked={formData.tools.includes(tool.id)} onChange={() => toggleTool(tool.id)} className="w-4 h-4 text-adhoc-violet rounded border-gray-300 focus:ring-adhoc-violet" />
                                            <span className="text-xl">{tool.icon}</span>
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{tool.name}</p>
                                                <p className="text-xs text-gray-500">{tool.description}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-adhoc-lavender cursor-pointer transition-colors">
                                    <input type="checkbox" checked={formData.ragEnabled} onChange={e => setFormData({ ...formData, ragEnabled: e.target.checked })} className="w-4 h-4 text-adhoc-violet rounded border-gray-300 focus:ring-adhoc-violet" />
                                    <span className="text-xl">📚</span>
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">Base de conocimiento</p>
                                        <p className="text-xs text-gray-500">Buscar en documentos subidos</p>
                                    </div>
                                </label>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">Cancelar</button>
                                <button type="submit" disabled={creating || !formData.name.trim()} className="flex-1 px-4 py-2.5 bg-adhoc-violet text-white rounded-lg hover:bg-adhoc-violet/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2">
                                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creando...</> : 'Crear Agente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
