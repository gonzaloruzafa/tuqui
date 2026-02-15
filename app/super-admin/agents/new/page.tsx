'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot, Loader2 } from 'lucide-react'

export default function CreateMasterAgentPage() {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [form, setForm] = useState({
        slug: '',
        name: '',
        description: '',
        system_prompt: '',
        icon: 'Bot',
    })

    const slugValid = /^[a-z][a-z0-9_-]{1,48}$/.test(form.slug)

    const createAgent = async () => {
        if (!form.slug || !form.name || !form.system_prompt) {
            setError('Slug, nombre y system prompt son requeridos')
            return
        }
        if (!slugValid) {
            setError('Slug inválido: solo minúsculas, números, guiones. Mín 2 chars.')
            return
        }

        setSaving(true)
        setError(null)

        try {
            const res = await fetch('/api/super-admin/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()

            if (res.ok) {
                router.push(`/super-admin/agents/${data.slug}`)
            } else {
                setError(data.error || 'Error al crear agente')
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex-grow max-w-3xl mx-auto px-6 py-10 w-full">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <Link href="/super-admin/agents" className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                </Link>
                <div className="w-12 h-12 rounded-xl bg-adhoc-violet/10 flex items-center justify-center text-adhoc-violet">
                    <Bot className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 font-display">Nuevo Agente</h1>
                    <span className="text-sm text-gray-400">Crear un nuevo master agent</span>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 underline">cerrar</button>
                </div>
            )}

            <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gray-50/20 flex items-center gap-2">
                    <Bot className="w-5 h-5 text-adhoc-violet" />
                    <h2 className="text-xl font-bold text-gray-900 font-display">Configuración</h2>
                </div>
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Slug</label>
                            <input
                                value={form.slug}
                                onChange={e => setForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                                placeholder="mi-agente"
                                className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all ${
                                    form.slug && !slugValid ? 'border-red-300' : 'border-gray-100'
                                }`}
                            />
                            {form.slug && !slugValid && (
                                <p className="text-xs text-red-500 mt-1">Debe empezar con letra, solo a-z 0-9 _ -, 2-49 chars</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nombre</label>
                            <input
                                value={form.name}
                                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Mi Agente"
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Descripción</label>
                        <input
                            value={form.description}
                            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="¿Qué hace este agente?"
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Ícono</label>
                        <input
                            value={form.icon}
                            onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
                            placeholder="Bot"
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all"
                        />
                        <p className="text-xs text-gray-400 mt-1">Nombre de ícono Lucide: Bot, Sparkles, Calculator, Scale, etc.</p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">System Prompt</label>
                        <textarea
                            value={form.system_prompt}
                            onChange={e => setForm(prev => ({ ...prev, system_prompt: e.target.value }))}
                            rows={10}
                            placeholder="Sos un asistente que..."
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 font-mono text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all resize-none"
                        />
                    </div>
                </div>
            </section>

            <div className="flex justify-end mt-6">
                <button
                    onClick={createAgent}
                    disabled={saving || !form.slug || !form.name || !form.system_prompt}
                    className="flex items-center gap-2 px-6 py-3 bg-adhoc-violet text-white rounded-xl text-sm font-medium hover:bg-adhoc-violet/90 transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    {saving ? 'Creando...' : 'Crear Agente'}
                </button>
            </div>
        </div>
    )
}
