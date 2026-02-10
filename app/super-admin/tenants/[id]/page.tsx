'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building, Users, Bot, Zap, Activity, Pencil, Check, X, Loader2, KeyRound, Trash2, Wrench, RefreshCw, UserPlus } from 'lucide-react'

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
        auth_user_id: string | null
        tokens_this_month: number
        requests_this_month: number
    }>
    agents: Array<{
        slug: string
        name: string
        is_active: boolean
        tools: string[]
        master_agent_id: string | null
        custom_instructions: string | null
        master_version_synced: number | null
        last_synced_at: string | null
    }>
    tools: string[]
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

    // User management state
    const [passwordModal, setPasswordModal] = useState<{ userId: string; email: string } | null>(null)
    const [newPassword, setNewPassword] = useState('')
    const [passwordSaving, setPasswordSaving] = useState(false)
    const [passwordError, setPasswordError] = useState('')
    const [deletingTenant, setDeletingTenant] = useState(false)

    // Create user state
    const [createUserModal, setCreateUserModal] = useState(false)
    const [newUserEmail, setNewUserEmail] = useState('')
    const [newUserPassword, setNewUserPassword] = useState('')
    const [newUserIsAdmin, setNewUserIsAdmin] = useState(false)
    const [creatingUser, setCreatingUser] = useState(false)
    const [createUserError, setCreateUserError] = useState('')

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

    const toggleActive = () => {
        if (!data) return
        const newState = !data.tenant.is_active

        const doToggle = async () => {
            if (!newState && !confirm('¿Desactivar este tenant? Los usuarios no podrán acceder.')) return

            // Optimistic update
            setData(prev => prev ? { ...prev, tenant: { ...prev.tenant, is_active: newState } } : prev)

            try {
                const res = await fetch(`/api/super-admin/tenants/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_active: newState }),
                })
                if (res.ok) await fetchDetail()
                else setData(prev => prev ? { ...prev, tenant: { ...prev.tenant, is_active: !newState } } : prev)
            } catch {
                setData(prev => prev ? { ...prev, tenant: { ...prev.tenant, is_active: !newState } } : prev)
            }
        }

        // Defer confirm() off the click handler to avoid blocking INP
        setTimeout(doToggle, 0)
    }

    const changePassword = async () => {
        if (!passwordModal || newPassword.length < 6) {
            setPasswordError('Mínimo 6 caracteres')
            return
        }
        setPasswordSaving(true)
        setPasswordError('')
        try {
            const res = await fetch(`/api/super-admin/tenants/${id}/users/${passwordModal.userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword }),
            })
            if (!res.ok) {
                const data = await res.json()
                setPasswordError(data.error || 'Error al cambiar contraseña')
            } else {
                setPasswordModal(null)
                setNewPassword('')
            }
        } catch {
            setPasswordError('Error de conexión')
        }
        setPasswordSaving(false)
    }

    const createUser = async () => {
        if (!newUserEmail.includes('@')) {
            setCreateUserError('Email inválido')
            return
        }
        if (newUserPassword.length < 6) {
            setCreateUserError('Mínimo 6 caracteres')
            return
        }
        setCreatingUser(true)
        setCreateUserError('')
        try {
            const res = await fetch(`/api/super-admin/tenants/${id}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newUserEmail, password: newUserPassword, is_admin: newUserIsAdmin }),
            })
            if (!res.ok) {
                const d = await res.json()
                setCreateUserError(d.error || 'Error al crear usuario')
            } else {
                setCreateUserModal(false)
                await fetchDetail()
            }
        } catch {
            setCreateUserError('Error de conexión')
        }
        setCreatingUser(false)
    }

    const deleteUser = (userId: string, email: string) => {
        setTimeout(async () => {
            if (!confirm(`¿Eliminar al usuario ${email}?\n\nSe elimina su acceso y cuenta. Las conversaciones y memorias se conservan.`)) return
            try {
                const res = await fetch(`/api/super-admin/tenants/${id}/users/${userId}`, { method: 'DELETE' })
                if (res.ok) await fetchDetail()
                else {
                    const d = await res.json()
                    alert(d.error || 'Error al eliminar usuario')
                }
            } catch { alert('Error de conexión') }
        }, 0)
    }

    const deleteTenant = () => {
        if (!data) return
        setTimeout(async () => {
            const confirmation = prompt(`Escribí "${data.tenant.name}" para confirmar la eliminación.\n\nSe borran TODOS los datos: usuarios, agentes, conversaciones, documentos.`)
            if (confirmation !== data.tenant.name) return
            setDeletingTenant(true)
            try {
                const res = await fetch(`/api/super-admin/tenants/${id}`, { method: 'DELETE' })
                if (res.ok) router.push('/super-admin/tenants')
                else {
                    const json = await res.json()
                    alert(json.error || 'Error al eliminar tenant')
                }
            } catch { alert('Error de conexión') }
            setDeletingTenant(false)
        }, 0)
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

    const { tenant, users, agents, tools, usage } = data
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
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-500" />
                        <h2 className="font-semibold text-gray-900">Usuarios ({users.length})</h2>
                    </div>
                    <button
                        onClick={() => { setCreateUserModal(true); setNewUserEmail(''); setNewUserPassword(''); setNewUserIsAdmin(false); setCreateUserError('') }}
                        className="text-gray-400 hover:text-adhoc-violet transition-colors"
                        title="Crear usuario"
                    >
                        <UserPlus className="w-4.5 h-4.5" />
                    </button>
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
                            <div className="flex items-center gap-3">
                                <div className="text-xs text-gray-400 font-mono flex items-center gap-3">
                                    <span>{u.tokens_this_month > 0 ? `${formatTokens(u.tokens_this_month)} tokens` : '—'}</span>
                                    {u.requests_this_month > 0 && (
                                        <span className="text-gray-300">·</span>
                                    )}
                                    {u.requests_this_month > 0 && (
                                        <span>{u.requests_this_month} msgs</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => { setPasswordModal({ userId: u.id, email: u.email }); setNewPassword(''); setPasswordError('') }}
                                    className="text-gray-400 hover:text-adhoc-violet transition-colors"
                                    title="Cambiar contraseña"
                                >
                                    <KeyRound className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => deleteUser(u.id, u.email)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                    title="Eliminar usuario"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {users.length === 0 && (
                        <p className="px-6 py-4 text-sm text-gray-400">Sin usuarios</p>
                    )}
                </div>
            </section>

            {/* Agents section */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
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
                                {a.last_synced_at && (
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1" title={`Sync: ${new Date(a.last_synced_at).toLocaleString('es-AR')}`}>
                                        <RefreshCw className="w-3 h-3" />
                                        {new Date(a.last_synced_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                    {agents.length === 0 && (
                        <p className="px-6 py-4 text-sm text-gray-400">Sin agentes</p>
                    )}
                </div>
            </section>

            {/* Tools section */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-gray-500" />
                    <h2 className="font-semibold text-gray-900">Herramientas ({tools.length})</h2>
                </div>
                <div className="px-6 py-4">
                    {tools.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {tools.map(t => (
                                <span key={t} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg font-medium">{t}</span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400">Sin herramientas configuradas</p>
                    )}
                </div>
            </section>

            {/* Danger zone */}
            <section className="mt-8 border border-red-200 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-red-700 mb-2">Zona peligrosa</h3>
                <p className="text-xs text-gray-500 mb-4">
                    Eliminar el tenant borra todos los datos asociados: usuarios, agentes, conversaciones, documentos e integraciones.
                </p>
                <button
                    onClick={deleteTenant}
                    disabled={deletingTenant}
                    className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                    {deletingTenant ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Eliminar tenant
                </button>
            </section>

            {/* Create user modal */}
            {createUserModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCreateUserModal(false)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="font-semibold text-gray-900 mb-1">Crear usuario</h3>
                        <p className="text-sm text-gray-500 mb-4">{tenant.name}</p>
                        <input
                            type="email"
                            value={newUserEmail}
                            onChange={e => setNewUserEmail(e.target.value)}
                            placeholder="Email"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 outline-none focus:border-adhoc-violet"
                            autoFocus
                        />
                        <input
                            type="password"
                            value={newUserPassword}
                            onChange={e => setNewUserPassword(e.target.value)}
                            placeholder="Contraseña (mín. 6 caracteres)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 outline-none focus:border-adhoc-violet"
                            onKeyDown={e => { if (e.key === 'Enter') createUser() }}
                        />
                        <label className="flex items-center gap-2 text-sm text-gray-700 mb-2 cursor-pointer">
                            <input type="checkbox" checked={newUserIsAdmin} onChange={e => setNewUserIsAdmin(e.target.checked)} className="rounded" />
                            Administrador
                        </label>
                        {createUserError && <p className="text-xs text-red-500 mb-2">{createUserError}</p>}
                        <div className="flex justify-end gap-2 mt-3">
                            <button onClick={() => setCreateUserModal(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">
                                Cancelar
                            </button>
                            <button
                                onClick={createUser}
                                disabled={creatingUser}
                                className="px-4 py-1.5 bg-adhoc-violet text-white text-sm rounded-lg hover:bg-adhoc-violet/90 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {creatingUser && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Password change modal */}
            {passwordModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setPasswordModal(null)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="font-semibold text-gray-900 mb-1">Cambiar contraseña</h3>
                        <p className="text-sm text-gray-500 mb-4">{passwordModal.email}</p>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Nueva contraseña (mín. 6 caracteres)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 outline-none focus:border-adhoc-violet"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') changePassword() }}
                        />
                        {passwordError && <p className="text-xs text-red-500 mb-2">{passwordError}</p>}
                        <div className="flex justify-end gap-2 mt-3">
                            <button onClick={() => setPasswordModal(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">
                                Cancelar
                            </button>
                            <button
                                onClick={changePassword}
                                disabled={passwordSaving}
                                className="px-4 py-1.5 bg-adhoc-violet text-white text-sm rounded-lg hover:bg-adhoc-violet/90 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {passwordSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
