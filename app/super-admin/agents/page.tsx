'use client'

import { useState, useEffect } from 'react'
import { Bot, FileText, Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

interface MasterAgent {
    id: string
    slug: string
    name: string
    icon: string
    is_published: boolean
    tools: string[]
    doc_count: number
}

export default function SuperAdminAgentsPage() {
    const [agents, setAgents] = useState<MasterAgent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAgents = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/super-admin/agents')
            const data = await res.json()
            if (res.ok) {
                setAgents(Array.isArray(data) ? data : [])
            } else {
                setError(data.error || 'Error desconocido')
            }
        } catch (err: any) {
            setError(err.message || 'Error de conexión')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchAgents() }, [])

    return (
        <div className="flex-grow max-w-5xl mx-auto px-6 py-10 w-full">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2 font-display">
                        <Bot className="w-8 h-8 text-adhoc-violet" />
                        Master Agents
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Agentes base de la plataforma y sus documentos RAG
                    </p>
                </div>
                <button
                    onClick={fetchAgents}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Recargar
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-adhoc-violet" />
                </div>
            ) : agents.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    No hay master agents configurados
                </div>
            ) : (
                <div className="space-y-3">
                    {agents.map(agent => (
                        <Link
                            key={agent.slug}
                            href={`/super-admin/agents/${agent.slug}`}
                            className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100 hover:border-adhoc-violet/30 hover:shadow-sm transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-adhoc-violet/10 flex items-center justify-center text-2xl flex-shrink-0">
                                {agent.icon || '🤖'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-gray-900 group-hover:text-adhoc-violet transition-colors">
                                        {agent.name}
                                    </h3>
                                    <span className="text-xs text-gray-400 font-mono">{agent.slug}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    {agent.tools?.map(tool => (
                                        <span key={tool} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                            {tool}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                                {agent.doc_count > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>{agent.doc_count} docs</span>
                                    </div>
                                )}
                                {agent.is_published ? (
                                    <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full">
                                        <Eye className="w-3 h-3" />
                                        Publicado
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-400 px-2 py-1 rounded-full">
                                        <EyeOff className="w-3 h-3" />
                                        Oculto
                                    </span>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
