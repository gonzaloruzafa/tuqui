'use client'

import { useState, useEffect, useMemo } from 'react'
import { Building, Plus, RefreshCw, Loader2, Search, Users, Zap, ChevronRight, X } from 'lucide-react'
import Link from 'next/link'

interface Tenant {
    id: string
    name: string
    slug: string
    is_active: boolean
    created_at: string
    user_count: number
    tokens_this_month: number
}

interface MasterAgent {
    slug: string
    name: string
    icon: string
    is_published: boolean
}

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
    return n.toString()
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'hoy'
    if (days === 1) return 'ayer'
    if (days < 30) return `hace ${days}d`
    const months = Math.floor(days / 30)
    if (months < 12) return `hace ${months}m`
    return `hace ${Math.floor(months / 12)}a`
}

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

export default function SuperAdminTenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [masterAgents, setMasterAgents] = useState<MasterAgent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [search, setSearch] = useState('')
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        adminEmail: '',
        adminPassword: '',
        selectedAgentSlugs: [] as string[],
    })
    const [slugManual, setSlugManual] = useState(false)
    const [creating, setCreating] = useState(false)

    const filteredTenants = useMemo(() => {
        if (!search) return tenants
        const q = search.toLowerCase()
        return tenants.filter(t =>
            t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
        )
    }, [tenants, search])

    const fetchTenants = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/super-admin/tenants')
            const data = await res.json()
            if (res.ok) {
                setTenants(Array.isArray(data) ? data : [])
            } else {
                setError(data.error || 'Error desconocido')
            }
        } catch (err: any) {
            setError(err.message || 'Error de conexión')
        } finally {
            setLoading(false)
        }
    }

    const fetchMasterAgents = async () => {
        try {
            const res = await fetch('/api/super-admin/agents')
            if (res.ok) {
                const data = await res.json()
                setMasterAgents(Array.isArray(data) ? data : [])
            }
        } catch { /* agents list is optional, fail silently */ }
    }

    const openModal = () => {
        setFormData({
            name: '', slug: '', adminEmail: '', adminPassword: '',
            selectedAgentSlugs: masterAgents.filter(a => a.is_published).map(a => a.slug),
        })
        setSlugManual(false)
        setShowModal(true)
    }

    const handleNameChange = (name: string) => {
        setFormData(prev => ({
            ...prev,
            name,
            slug: slugManual ? prev.slug : generateSlug(name),
        }))
    }

    const toggleAgent = (slug: string) => {
        setFormData(prev => ({
            ...prev,
            selectedAgentSlugs: prev.selectedAgentSlugs.includes(slug)
                ? prev.selectedAgentSlugs.filter(s => s !== slug)
                : [...prev.selectedAgentSlugs, slug],
        }))
    }

    const createTenant = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)

        try {
            const res = await fetch('/api/super-admin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    slug: formData.slug || undefined,
                    adminEmail: formData.adminEmail,
                    adminPassword: formData.adminPassword,
                    selectedAgentSlugs: formData.selectedAgentSlugs,
                })
            })

            if (res.ok) {
                setShowModal(false)
                fetchTenants()
            } else {
                const data = await res.json()
                alert('Error al crear tenant: ' + data.error)
            }
        } catch {
            alert('Error al crear tenant')
        }

        setCreating(false)
    }

    const syncMasters = async () => {
        if (!confirm('¿Sincronizar todos los agentes desde master_agents? Esto actualizará todos los tenants.')) return

        setSyncing(true)
        try {
            const res = await fetch('/api/super-admin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync_masters' })
            })

            if (res.ok) {
                alert('✅ Agents sincronizados correctamente')
            } else {
                const data = await res.json()
                alert('❌ Error al sincronizar: ' + data.error)
            }
        } catch {
            alert('❌ Error al sincronizar')
        }

        setSyncing(false)
    }

    useEffect(() => {
        fetchTenants()
        fetchMasterAgents()
    }, [])

    return (
        <>
            <div className="flex-grow max-w-7xl mx-auto px-6 py-10 w-full">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2 font-display">
                            <Building className="w-8 h-8 text-adhoc-violet" />
                            Gestión de Tenants
                        </h1>
                        <p className="text-gray-500 mt-1">Panel Super Admin — {tenants.length} tenants</p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={syncMasters}
                            disabled={syncing}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Sincronizando...' : 'Sync Masters'}
                        </button>

                        <button
                            onClick={openModal}
                            className="flex items-center gap-2 px-4 py-2 bg-adhoc-violet text-white rounded-lg hover:bg-adhoc-violet/90 shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo Tenant
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre o slug..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet"
                    />
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-adhoc-violet" />
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <p className="text-red-600 font-medium">Error: {error}</p>
                        <button
                            onClick={fetchTenants}
                            className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-red-700"
                        >
                            Reintentar
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50/50 border-b border-adhoc-lavender/30">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tenant</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Usuarios</span>
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Tokens (mes)</span>
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Creado</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-adhoc-lavender/20">
                                {filteredTenants.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{t.name}</div>
                                            <div className="text-xs text-gray-400 mt-0.5">{t.slug}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 text-sm">{t.user_count}</td>
                                        <td className="px-6 py-4 text-gray-600 text-sm font-mono">
                                            {t.tokens_this_month > 0 ? formatTokens(t.tokens_this_month) : '—'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                                t.is_active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {t.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-sm">{timeAgo(t.created_at)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/super-admin/tenants/${t.id}`}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-adhoc-violet hover:text-adhoc-violet/80"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {filteredTenants.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            {search ? 'No se encontraron tenants.' : 'No hay tenants creados.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal crear tenant */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold font-display">Crear Nuevo Tenant</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={createTenant} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-700">Nombre del Tenant</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => handleNameChange(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-adhoc-violet focus:border-transparent"
                                    placeholder="Ej: Empresa ABC"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-700">Slug</label>
                                <input
                                    type="text"
                                    value={formData.slug}
                                    onChange={e => { setSlugManual(true); setFormData(prev => ({ ...prev, slug: e.target.value })) }}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-adhoc-violet focus:border-transparent font-mono text-sm"
                                    placeholder="empresa-abc"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    Se auto-genera desde el nombre. Editá solo si es necesario.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-700">Email Admin</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.adminEmail}
                                    onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-adhoc-violet focus:border-transparent"
                                    placeholder="admin@empresa.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-700">Contraseña Admin</label>
                                <input
                                    type="password"
                                    required
                                    value={formData.adminPassword}
                                    onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-adhoc-violet focus:border-transparent"
                                    placeholder="Mínimo 8 caracteres"
                                    minLength={8}
                                />
                            </div>

                            {/* Agent selection */}
                            {masterAgents.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700">
                                        Agentes ({formData.selectedAgentSlugs.length}/{masterAgents.length})
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                                        {masterAgents.map(agent => (
                                            <label key={agent.slug} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1.5 rounded-md">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.selectedAgentSlugs.includes(agent.slug)}
                                                    onChange={() => toggleAgent(agent.slug)}
                                                    className="w-4 h-4 text-adhoc-violet rounded border-gray-300 focus:ring-adhoc-violet"
                                                />
                                                <span className="text-lg">{agent.icon || '🤖'}</span>
                                                <span className="text-sm font-medium text-gray-700">{agent.name}</span>
                                                {!agent.is_published && (
                                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">borrador</span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 px-4 py-2 bg-adhoc-violet text-white rounded-lg hover:bg-adhoc-violet/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {creating ? 'Creando...' : 'Crear Tenant'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
