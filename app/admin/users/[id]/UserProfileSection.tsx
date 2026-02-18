'use client'

import { useTransition, useState } from 'react'
import { Save, Loader2, Check, Sparkles, User } from 'lucide-react'
import { saveProfileAction } from '../actions'
import { DictationTextarea } from '@/components/ui/DictationTextarea'

interface ProfileData {
  display_name: string
  role_title: string
  area: string
  bio: string
  interests: string
}

interface Props {
  userId: string
  profile: ProfileData | null
}

export function UserProfileSection({ userId, profile }: Props) {
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [discovering, setDiscovering] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [askOdooName, setAskOdooName] = useState(false)
  const [odooName, setOdooName] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      setToast(null)
      try {
        await saveProfileAction(userId, formData)
        setToast({ type: 'success', message: 'Perfil guardado' })
      } catch {
        setToast({ type: 'error', message: 'Error al guardar' })
      }
      setTimeout(() => setToast(null), 4000)
    })
  }

  const handleDiscovery = async (name: string) => {
    setDiscovering(true)
    setDiscoveryError(null)
    try {
      const params = new URLSearchParams({ userId, odooName: name })
      const res = await fetch(`/api/admin/discover-user?${params}`)
      const data = await res.json()
      if (data.success && data.data) {
        setAskOdooName(false)
        const form = document.querySelector('[data-profile-form]') as HTMLFormElement
        if (!form) return
        const fieldMap: Record<string, string> = {
          role_title: 'role_title',
          area: 'area',
          bio: 'bio',
          interests: 'interests',
        }
        for (const [key, fieldName] of Object.entries(fieldMap)) {
          const value = data.data[key]
          if (value) {
            const input = form.querySelector(`[name="${fieldName}"]`) as HTMLInputElement | HTMLTextAreaElement
            if (input) {
              if (input.tagName === 'TEXTAREA') {
                window.dispatchEvent(new CustomEvent('tuqui:autofill', { detail: { name: fieldName, value } }))
              } else {
                input.value = value
              }
            }
          }
        }
      } else {
        setDiscoveryError(data.error || 'No se encontró ese usuario en Odoo')
      }
    } catch (e) {
      console.error('[UserDiscovery] Error:', e)
      setDiscoveryError('Error al conectar con Odoo')
    } finally {
      setDiscovering(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
      <div className="p-6 border-b border-gray-50 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-adhoc-violet" />
            <h2 className="text-lg font-semibold text-gray-900">Perfil</h2>
          </div>
          <button
            type="button"
            onClick={() => { setAskOdooName(true); setDiscoveryError(null) }}
            disabled={discovering}
            className="flex items-center gap-2 px-4 py-2 bg-adhoc-violet text-white rounded-xl text-xs font-semibold hover:bg-adhoc-violet/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm whitespace-nowrap"
          >
            <Sparkles className={`w-3.5 h-3.5 ${discovering ? 'animate-pulse' : ''}`} />
            {discovering ? 'Detectando...' : 'Detectar desde Odoo'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Tuqui usa estos datos para personalizar tus respuestas
        </p>
        {askOdooName && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={odooName}
              onChange={e => setOdooName(e.target.value)}
              placeholder="Usuario o nombre en Odoo (ej: mtravella o Martin Travella)"
              autoFocus
              className="flex-grow bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none"
              onKeyDown={e => { if (e.key === 'Enter' && odooName.trim()) handleDiscovery(odooName.trim()) }}
            />
            <button
              type="button"
              onClick={() => odooName.trim() && handleDiscovery(odooName.trim())}
              disabled={discovering || !odooName.trim()}
              className="px-3 py-1.5 bg-adhoc-violet text-white rounded-lg text-xs font-semibold hover:bg-adhoc-violet/90 transition-colors disabled:opacity-60"
            >
              {discovering ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        )}
        {discoveryError && (
          <p className="text-xs text-red-500 mt-1">{discoveryError}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} data-profile-form className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Nombre</label>
            <input type="text" name="display_name" defaultValue={profile?.display_name || ''}
              placeholder="Ej: Gonzalo Ruzafa"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Cargo</label>
            <input type="text" name="role_title" defaultValue={profile?.role_title || ''}
              placeholder="Ej: Director Comercial"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Área</label>
          <input type="text" name="area" defaultValue={profile?.area || ''}
            placeholder="Ej: Ventas, Administración, Dirección"
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-adhoc-violet/20 focus:border-adhoc-violet outline-none transition-all" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Intereses / Enfoque</label>
          <DictationTextarea
            name="interests"
            defaultValue={profile?.interests || ''}
            placeholder="Ej: Seguimiento de pedidos grandes, rentabilidad por producto, pipeline de CRM"
            rows={2}
          />
          <p className="text-xs text-gray-400 mt-1">Tuqui priorizará información relevante a tus intereses</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Sobre vos</label>
          <DictationTextarea
            name="bio"
            defaultValue={profile?.bio || ''}
            placeholder="Ej: Me enfoco en clientes grandes y la rentabilidad. Quiero estar al tanto del stock y las cobranzas."
            rows={3}
          />
          <p className="text-xs text-gray-400 mt-1">Se guarda en la memoria de Tuqui — aparece cuando es relevante</p>
        </div>

        <div className="flex items-center justify-end gap-4">
          {toast && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
              {toast.type === 'success' ? <Check className="w-4 h-4" /> : '⚠️'}
              {toast.message}
            </div>
          )}
          <button type="submit" disabled={isPending}
            className="px-6 py-3 bg-adhoc-violet text-white rounded-xl font-semibold hover:bg-adhoc-violet/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Perfil
          </button>
        </div>
      </form>
    </section>
  )
}
