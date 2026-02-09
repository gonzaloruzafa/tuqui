'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building, Users, Bot, Zap, Activity, Pencil, Check, X, Loader2 } from 'lucide-react'

interface TenantDetail {
    tenant: {
        id: string
        name: string
        slug: string
        is_active: boolean
        created_at: string
    }
    users: Array<{
        id: string
        email: string
        name: string | null
        is_admin: boolean
        tokens_this_month: number
        requests_this_month: number
    }>
    agents: Array<{
        slug: string
        name: string
        is_active: boolean
        master_agent_id: string | null
        custom_instructions: string | null
    }>
    usage: {
        totalTokens: number
        totalRequests: number
    }
}

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
    return n.toString()
}

export default function TenantDetailPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string

    const [data, setData] = useState<TenantDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Inline edit state
    const [editingName, setEditingName] = useState(false)
    const [nameValue, setNameValue] = useState('')
    const [saving, setSaving] = useState(false)

    const fetchDetail = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/super-admin/tenants/${id}`)
            if (!res.ok) throw new Error('Tenant no encontrado')
            const json = await res.json()
            setData(json)
            setNameValue(json.tenant.name)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const saveName = async () => {
        if (!nameValue.trim() || nameValue === data?.tenant.name) {
            setEditingName(false)
            return
        }
        setSaving(true)
        try {
            const res = await fetch(`/api/super-admin/tenants/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: nameValue.trim() }),
            })
            if (res.ok) {
                await fetchDetail()
                setEditingName(false)
            }
        } catch { /* ignore */ }
        setSaving(false)
    }

    const toggleActive = async () => {
        if (!data) return
        const newState = !data.tenant.is_active
        if (!newState && !confirm('¿Desactivar este tenant? Los usuarios no podrán acceder.')) return

        try {
            const res = await fetch(`/api/super-admin/tenants/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: newState }),
            })
            if (res.ok) await fetchDetail()
        } catch { /* ignore */ }
    }

    useEffect(() => { fetchDetail() }, [id])

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-adhoc-violet" />
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-10">
                <p className="text-red-600">Error: {error || 'Tenant no encontrado'}</p>
                <Link href="/super-admin/tenants" className="text-adhoc-violet mt-4 inline-block">← Volver</Link>
            </div>
        )
    }

    const { tenant, users, agents, usage } = data
    const activeAgents = agents.filter(a => a.is_active)

    return (
        <div className="flex-grow max-w-5xl mx-auto px-6 py-10 w-full">
            {/* Back link */}
            <Link href="/super-admin/tenants" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-adhoc-violet mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Volver a tenants
            </Link>

            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-adhoc-violet/10 rounded-xl flex items-center justify-center">
                        <Building className="w-6 h-6 text-adhoc-violet" />
                    </div>
                    <div>
                        {editingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={nameValue}
                                    onChange={e => setNameValue(e.target.value)}
                                    className="text-2xl font-bold border-b-2 border-adhoc-violet outline-none bg-transparent"
                                    autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                                />
                                <button onClick={saveName} disabled={saving} className="text-green-600 hover:text-green-700">
                                    <Check className="w-5 h-5" />
                                </button>
                                <button onClick={() => { setEditingName(false); setNameValue(tenant.name) }} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-gray-900 font-display">{tenant.name}</h1>
                                <button onClick={() => setEditingName(true)} className="text-gray-400 hover:text-adhoc-violet">
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <p className="text-sm text-gray-500 mt-0.5">
                            <span className="font-mono">{tenant.slug}</span>
                            {' · '}
                            Creado {new Date(tenant.created_at).toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                    </div>
                </div>

                <button
                    onClick={toggleActive}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        tenant.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    {tenant.is_active ? '● Activo' : '○ Inactivo'}
                </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
                        <Users className="w-3.5 h-3.5" /> USUARIOS
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
                        <Zap className="w-3.5 h-3.5" /> TOKENS (MES)
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatTokens(usage.totalTokens)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
                        <Activity className="w-3.5 h-3.5" /> MENSAJES (MES)
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{usage.totalRequests}</p>
                </div>
            </div>

            {/* Users section */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-500" />
                    <h2 className="font-semibold text-gray-900">Usuarios ({users.length})</h2>
                </div>
                <div className="divide-y divide-gray-50">
                    {users.map(u => (
                        <div key={u.id} className="px-6 py-3 flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium text-gray-900">{u.email}</span>
                                {u.is_admin && (
                                    <span className="ml-2 text-[10px] bg-adhoc-violet/10 text-adhoc-violet px-1.5 py-0.5 rounded font-medium">admin</span>
                                )}
                            </div>
                            <div className="text-xs text-gray-400 font-mono">
                                {u.tokens_this_month > 0 ? `${formatTokens(u.tokens_this_month)} tokens` : '—'}
                            </div>
                        </div>
                    ))}
                    {users.length === 0 && (
                        <p className="px-6 py-4 text-sm text-gray-400">Sin usuarios</p>
                    )}
                </div>
            </section>

            {/* Agents section */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Bot className="w-5 h-5 text-gray-500" />
                    <h2 className="font-semibold text-gray-900">
                        Agentes ({activeAgents.length} activos / {agents.length} total)
                    </h2>
                </div>
                <div className="divide-y divide-gray-50">
                    {agents.map(a => (
                        <div key={a.slug} className="px-6 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${a.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className="text-sm font-medium text-gray-900">{a.name}</span>
                                {a.master_agent_id && (
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">base</span>
                                )}
                                {!a.master_agent_id && (
                                    <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">custom</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {a.custom_instructions && (
                                    <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">📝 custom prompt</span>
                                )}
                            </div>
                        </div>
                    ))}
                    {agents.length === 0 && (
                        <p className="px-6 py-4 text-sm text-gray-400">Sin agentes</p>
                    )}
                </div>
            </section>
        </div>
    )
}
