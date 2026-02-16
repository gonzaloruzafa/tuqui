'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot, Save, FileText, Trash2, Upload, Loader2, BookOpen, Wrench, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { AgentIcon } from '@/components/ui/AgentIcon'
import { TOOL_LABELS } from '@/lib/constants/tools'

interface MasterAgent {
    id: string
    slug: string
    name: string
    description: string | null
    icon: string
    color: string
    system_prompt: string
    welcome_message: string | null
    placeholder_text: string | null
    tools: string[]
    is_published: boolean
    sort_order: number
}

interface MasterDoc {
    id: string
    title: string
    file_name: string | null
    source_type: string
    created_at: string
}

export default function SuperAdminAgentEditorPage() {
    const params = useParams()
    const router = useRouter()
    const slug = params.slug as string
    const isCreateMode = slug === 'new'

    const [agent, setAgent] = useState<MasterAgent | null>(isCreateMode ? { id: '', slug: '', name: '', description: null, icon: 'Bot', color: 'violet', system_prompt: '', welcome_message: null, placeholder_text: null, tools: [], is_published: true, sort_order: 0 } : null)
    const [docs, setDocs] = useState<MasterDoc[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState('')
    const [syncing, setSyncing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [form, setForm] = useState({
        slug: '',
        name: '',
        description: '',
        system_prompt: '',
        welcome_message: '',
        placeholder_text: '',
        tools: [] as string[],
        is_published: true,
        icon: '',
        color: 'violet',
        sort_order: 0,
    })

    const fetchAgent = useCallback(async () => {
        if (isCreateMode) return
        try {
            const res = await fetch(`/api/super-admin/agents/${slug}`)
            if (!res.ok) { setError('Agent not found'); return }
            const data = await res.json()
            setAgent(data)
            setForm({
                slug: data.slug || '',
                name: data.name || '',
                description: data.description || '',
                system_prompt: data.system_prompt || '',
                welcome_message: data.welcome_message || '',
                placeholder_text: data.placeholder_text || '',
                tools: data.tools || [],
                is_published: data.is_published ?? true,
                icon: data.icon || '',
                color: data.color || 'violet',
                sort_order: data.sort_order ?? 0,
            })
        } catch (err: any) {
            setError(err.message)
        }
    }, [slug, isCreateMode])

    const fetchDocs = useCallback(async () => {
        if (isCreateMode) return
        try {
            const res = await fetch(`/api/super-admin/agents/${slug}/documents`)
            if (res.ok) {
                const data = await res.json()
                setDocs(Array.isArray(data) ? data : [])
            }
        } catch { /* fail silently */ }
    }, [slug, isCreateMode])

    useEffect(() => {
        if (isCreateMode) { setLoading(false); return }
        Promise.all([fetchAgent(), fetchDocs()]).finally(() => setLoading(false))
    }, [fetchAgent, fetchDocs])

    const saveAgent = async () => {
        setSaving(true)
        setError(null)
        setSuccess(null)

        // Validate slug
        if (!form.slug || !/^[a-z][a-z0-9_-]{1,48}$/.test(form.slug)) {
            setError('Slug inválido: solo minúsculas, números, guiones. 2-49 chars, empieza con letra.')
            setSaving(false)
            return
        }
        if (!form.name || !form.system_prompt) {
            setError('Nombre y system prompt son requeridos')
            setSaving(false)
            return
        }

        try {
            if (isCreateMode) {
                const res = await fetch('/api/super-admin/agents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                })
                const data = await res.json()
                if (res.ok) {
                    router.push(`/super-admin/agents/${data.slug}`)
                    return
                } else {
                    setError(data.error || 'Error al crear agente')
                }
            } else {
                const res = await fetch(`/api/super-admin/agents/${slug}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                })
                if (res.ok) {
                    const data = await res.json()
                    if (data.slug && data.slug !== slug) {
                        router.push(`/super-admin/agents/${data.slug}`)
                        return
                    }
                    setSuccess('Guardado correctamente')
                    setTimeout(() => setSuccess(null), 3000)
                } else {
                    const data = await res.json()
                    setError(data.error || 'Error al guardar')
                }
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const uploadDocs = async (files: File[]) => {
        setUploading(true)
        setError(null)
        const total = files.length
        let successCount = 0
        const errors: string[] = []

        for (let i = 0; i < total; i++) {
            const file = files[i]
            const prefix = total > 1 ? `[${i + 1}/${total}] ` : ''
            try {
                // 1. Get signed upload URL
                setUploadProgress(`${prefix}Obteniendo URL para ${file.name}...`)
                const urlRes = await fetch(`/api/super-admin/agents/${slug}/documents`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_upload_url', fileName: file.name }),
                })
                if (!urlRes.ok) {
                    let errorMsg = 'Error obteniendo URL de subida'
                    try { const data = await urlRes.json(); errorMsg = data.error || errorMsg } catch {}
                    throw new Error(errorMsg)
                }
                const { signedUrl, path } = await urlRes.json()

                // 2. Upload file directly to Supabase Storage
                setUploadProgress(`${prefix}Subiendo ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`)
                const uploadRes = await fetch(signedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': file.type || 'application/pdf' },
                    body: file,
                })
                if (!uploadRes.ok) throw new Error('Error subiendo archivo a Storage')

                // 3. Process from Storage (chunk + embed)
                setUploadProgress(`${prefix}Procesando ${file.name}: chunks + embeddings...`)
                const processRes = await fetch(`/api/super-admin/agents/${slug}/documents`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'process_from_storage',
                        storagePath: path,
                        fileName: file.name,
                        fileSize: file.size,
                        title: file.name.replace(/\.(pdf|txt|md)$/i, ''),
                    }),
                })

                let responseData: any = null
                try { responseData = await processRes.json() } catch {
                    throw new Error(`${file.name}: procesamiento tardó demasiado — recargá la página.`)
                }
                if (!processRes.ok) throw new Error(responseData?.error || `Error procesando ${file.name}`)
                successCount++
            } catch (err: any) {
                errors.push(err.message)
            }
        }

        await fetchDocs()
        if (successCount > 0) {
            setSuccess(`${successCount} documento${successCount > 1 ? 's' : ''} procesado${successCount > 1 ? 's' : ''} correctamente`)
            setTimeout(() => setSuccess(null), 5000)
        }
        if (errors.length > 0) setError(errors.join(' | '))
        setUploading(false)
        setUploadProgress('')
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
                let errorMsg = 'Error al eliminar'
                try { const data = await res.json(); errorMsg = data.error || errorMsg } catch {}
                setError(errorMsg)
            }
        } catch (err: any) {
            setError(err.message)
        }
    }

    const syncToTenants = async () => {
        if (!confirm('¿Sincronizar este agente a todos los tenants? Se actualizará el prompt, herramientas y descripción.')) return

        setSyncing(true)
        setError(null)
        try {
            const res = await fetch('/api/super-admin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync_masters' }),
            })
            if (res.ok) {
                setSuccess('Agentes sincronizados a todos los tenants')
                setTimeout(() => setSuccess(null), 5000)
            } else {
                const data = await res.json()
                setError(data.error || 'Error al sincronizar')
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSyncing(false)
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

    const deleteAgent = async () => {
        if (!confirm(`¿Eliminar el agente "${agent?.name}"? Se borran todos sus documentos. Esta acción es irreversible.`)) return

        try {
            const res = await fetch(`/api/super-admin/agents/${slug}`, { method: 'DELETE' })
            if (res.ok) {
                router.push('/super-admin/agents')
            } else {
                const data = await res.json()
                setError(data.error || 'Error al eliminar')
            }
        } catch (err: any) {
            setError(err.message)
        }
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
                <Link href="/super-admin/agents" className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                </Link>
                <div className="w-12 h-12 rounded-xl bg-adhoc-violet/10 flex items-center justify-center text-adhoc-violet">
                    <AgentIcon name={agent.icon} className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 font-display">{isCreateMode ? 'Nuevo Agente' : (form.name || agent.name)}</h1>
                    <span className="text-sm text-gray-400 font-mono">{isCreateMode ? 'Crear un nuevo master agent' : (form.slug || agent.slug)}</span>
                </div>
                {!isCreateMode && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={syncToTenants}
                            disabled={syncing}
                            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Sincronizando...' : 'Sync a tenants'}
                        </button>
                        <button
                            onClick={deleteAgent}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Eliminar agente"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
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
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Slug</label>
                                <input
                                    value={form.slug}
                                    onChange={e => setForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                                    className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all ${
                                        form.slug && !/^[a-z][a-z0-9_-]{1,48}$/.test(form.slug) ? 'border-red-300' : 'border-gray-100'
                                    }`}
                                />
                                {form.slug && !/^[a-z][a-z0-9_-]{1,48}$/.test(form.slug) && (
                                    <p className="text-xs text-red-500 mt-1">Debe empezar con letra, solo a-z 0-9 _ -, 2-49 chars</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nombre</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                />
                            </div>
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
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Ícono</label>
                                <input
                                    value={form.icon}
                                    onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
                                    placeholder="Bot"
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Color</label>
                                <input
                                    value={form.color}
                                    onChange={e => setForm(prev => ({ ...prev, color: e.target.value }))}
                                    placeholder="violet"
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Orden</label>
                                <input
                                    type="number"
                                    value={form.sort_order}
                                    onChange={e => setForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
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

                {/* Documents / RAG — visible when knowledge_base tool is active */}
                {!isCreateMode && form.tools.includes('knowledge_base') && (
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
                                accept=".pdf,.txt,.md"
                                multiple
                                className="hidden"
                                onChange={e => {
                                    const files = e.target.files
                                    if (files && files.length > 0) uploadDocs(Array.from(files))
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
                                {uploading ? 'Procesando...' : 'Subir Documentos'}
                            </button>
                            {uploadProgress ? (
                                <p className="text-[11px] text-adhoc-violet mt-2 flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {uploadProgress}
                                </p>
                            ) : (
                                <p className="text-[11px] text-gray-400 mt-2">
                                    Podés seleccionar varios archivos a la vez. Se procesan chunks y embeddings automáticamente.
                                </p>
                            )}
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
                )}

                {/* Save */}
                <div className="sticky bottom-6 z-10 bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-100 shadow-lg">
                    <button
                        type="button"
                        onClick={saveAgent}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-adhoc-violet text-white rounded-xl text-sm font-medium hover:bg-adhoc-violet/90 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? (isCreateMode ? 'Creando...' : 'Guardando...') : (isCreateMode ? 'Crear Agente' : 'Guardar Cambios')}
                    </button>
                </div>
            </div>
        </div>
    )
}
