'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot, Save, FileText, Trash2, Upload, Loader2, BookOpen, Wrench, Eye, EyeOff } from 'lucide-react'

interface MasterAgent {
    id: string
    slug: string
    name: string
    description: string | null
    icon: string
    system_prompt: string
    welcome_message: string | null
    placeholder_text: string | null
    tools: string[]
    is_published: boolean
}

interface MasterDoc {
    id: string
    title: string
    file_name: string | null
    source_type: string
    created_at: string
}

const TOOL_LABELS: Record<string, string> = {
    web_search: 'Búsqueda Web',
    odoo_intelligent_query: 'Odoo ERP',
    knowledge_base: 'Base de Conocimiento',
    memory: 'Memoria',
}

export default function SuperAdminAgentEditorPage() {
    const params = useParams()
    const router = useRouter()
    const slug = params.slug as string

    const [agent, setAgent] = useState<MasterAgent | null>(null)
    const [docs, setDocs] = useState<MasterDoc[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Form state
    const [form, setForm] = useState({
        name: '',
        description: '',
        system_prompt: '',
        welcome_message: '',
        placeholder_text: '',
        tools: [] as string[],
        is_published: true,
        icon: '',
    })

    const fetchAgent = useCallback(async () => {
        try {
            const res = await fetch(`/api/super-admin/agents/${slug}`)
            if (!res.ok) { setError('Agent not found'); return }
            const data = await res.json()
            setAgent(data)
            setForm({
                name: data.name || '',
                description: data.description || '',
                system_prompt: data.system_prompt || '',
                welcome_message: data.welcome_message || '',
                placeholder_text: data.placeholder_text || '',
                tools: data.tools || [],
                is_published: data.is_published ?? true,
                icon: data.icon || '',
            })
        } catch (err: any) {
            setError(err.message)
        }
    }, [slug])

    const fetchDocs = useCallback(async () => {
        try {
            const res = await fetch(`/api/super-admin/agents/${slug}/documents`)
            if (res.ok) {
                const data = await res.json()
                setDocs(Array.isArray(data) ? data : [])
            }
        } catch { /* fail silently */ }
    }, [slug])

    useEffect(() => {
        Promise.all([fetchAgent(), fetchDocs()]).finally(() => setLoading(false))
    }, [fetchAgent, fetchDocs])

    const saveAgent = async () => {
        setSaving(true)
        setError(null)
        setSuccess(null)
        try {
            const res = await fetch(`/api/super-admin/agents/${slug}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            if (res.ok) {
                setSuccess('Guardado correctamente')
                setTimeout(() => setSuccess(null), 3000)
            } else {
                const data = await res.json()
                setError(data.error || 'Error al guardar')
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const uploadDoc = async (file: File) => {
        setUploading(true)
        setError(null)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('title', file.name.replace(/\.pdf$/i, ''))

            const res = await fetch(`/api/super-admin/agents/${slug}/documents`, {
                method: 'POST',
                body: formData,
            })

            if (res.ok) {
                const doc = await res.json()
                setDocs(prev => [...prev, { ...doc, source_type: 'file', created_at: new Date().toISOString() }])
                setSuccess(`"${doc.title}" procesado correctamente`)
                setTimeout(() => setSuccess(null), 3000)
            } else {
                const data = await res.json()
                setError(data.error || 'Error al subir documento')
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setUploading(false)
        }
    }

    const deleteDoc = async (docId: string) => {
        if (!confirm('¿Eliminar este documento? Se borrará para todos los tenants.')) return

        try {
            const res = await fetch(`/api/super-admin/agents/${slug}/documents`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentId: docId }),
            })
            if (res.ok) {
                setDocs(prev => prev.filter(d => d.id !== docId))
            } else {
                const data = await res.json()
                setError(data.error || 'Error al eliminar')
            }
        } catch (err: any) {
            setError(err.message)
        }
    }

    const toggleTool = (tool: string) => {
        setForm(prev => ({
            ...prev,
            tools: prev.tools.includes(tool)
                ? prev.tools.filter(t => t !== tool)
                : [...prev.tools, tool],
        }))
    }

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-adhoc-violet" />
            </div>
        )
    }

    if (!agent) {
        return (
            <div className="max-w-3xl mx-auto px-6 py-10">
                <p className="text-red-500">Agent not found</p>
                <Link href="/super-admin/agents" className="text-adhoc-violet hover:underline mt-4 inline-block">
                    ← Volver
                </Link>
            </div>
        )
    }

    return (
        <div className="flex-grow max-w-4xl mx-auto px-6 py-10 w-full">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <Link
                    href="/super-admin/agents"
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                </Link>
                <div className="w-12 h-12 rounded-xl bg-adhoc-violet/10 flex items-center justify-center text-2xl">
                    {agent.icon || '🤖'}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 font-display">{agent.name}</h1>
                    <span className="text-sm text-gray-400 font-mono">{agent.slug}</span>
                </div>
            </div>

            {/* Notifications */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 underline">cerrar</button>
                </div>
            )}
            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 text-emerald-700 text-sm">
                    {success}
                </div>
            )}

            <div className="space-y-8">
                {/* Agent Config */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bot className="w-5 h-5 text-adhoc-violet" />
                            <h2 className="text-xl font-bold text-gray-900 font-display">Configuración</h2>
                        </div>
                        <button
                            onClick={() => setForm(prev => ({ ...prev, is_published: !prev.is_published }))}
                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                form.is_published
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'bg-gray-50 border-gray-200 text-gray-500'
                            }`}
                        >
                            {form.is_published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            {form.is_published ? 'Publicado' : 'Oculto'}
                        </button>
                    </div>
                    <div className="p-6 space-y-5">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nombre</label>
                            <input
                                value={form.name}
                                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Descripción</label>
                            <input
                                value={form.description}
                                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">System Prompt</label>
                            <textarea
                                value={form.system_prompt}
                                onChange={e => setForm(prev => ({ ...prev, system_prompt: e.target.value }))}
                                rows={10}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 font-mono text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all resize-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Welcome Message</label>
                                <textarea
                                    value={form.welcome_message}
                                    onChange={e => setForm(prev => ({ ...prev, welcome_message: e.target.value }))}
                                    rows={3}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Placeholder Text</label>
                                <textarea
                                    value={form.placeholder_text}
                                    onChange={e => setForm(prev => ({ ...prev, placeholder_text: e.target.value }))}
                                    rows={3}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all resize-none"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Tools */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/20 flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-adhoc-violet" />
                        <h2 className="text-xl font-bold text-gray-900 font-display">Herramientas</h2>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(TOOL_LABELS).map(([tool, label]) => (
                                <button
                                    key={tool}
                                    type="button"
                                    onClick={() => toggleTool(tool)}
                                    className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                                        form.tools.includes(tool)
                                            ? 'bg-adhoc-violet text-white border-adhoc-violet'
                                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Documents / RAG */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-adhoc-violet" />
                            <h2 className="text-xl font-bold text-gray-900 font-display">Documentos RAG</h2>
                        </div>
                        <span className="text-xs text-gray-400">{docs.length} documento{docs.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="p-6">
                        {/* Upload */}
                        <div className="mb-6">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                onChange={e => {
                                    const file = e.target.files?.[0]
                                    if (file) uploadDoc(file)
                                    e.target.value = ''
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex items-center gap-2 px-5 py-3 bg-adhoc-violet text-white rounded-xl text-sm font-medium hover:bg-adhoc-violet/90 transition-colors disabled:opacity-50"
                            >
                                {uploading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4" />
                                )}
                                {uploading ? 'Procesando...' : 'Subir PDF'}
                            </button>
                            <p className="text-[11px] text-gray-400 mt-2">
                                El archivo se procesa, se divide en chunks y se generan embeddings automáticamente.
                            </p>
                        </div>

                        {/* Doc list */}
                        {docs.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-6">
                                No hay documentos cargados para este agente
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {docs.map(doc => (
                                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <FileText className="w-4 h-4 text-adhoc-violet flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                                            {doc.file_name && (
                                                <p className="text-[11px] text-gray-400 truncate">{doc.file_name}</p>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                                            {new Date(doc.created_at).toLocaleDateString('es-AR')}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => deleteDoc(doc.id)}
                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar documento"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Save */}
                <div className="sticky bottom-6 z-10 bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-100 shadow-lg">
                    <button
                        type="button"
                        onClick={saveAgent}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-adhoc-violet text-white rounded-xl text-sm font-medium hover:bg-adhoc-violet/90 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    )
}
