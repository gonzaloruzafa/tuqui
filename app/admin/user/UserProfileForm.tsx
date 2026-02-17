'use client'

import { useTransition, useState } from 'react'
import { Save, Loader2, Check, Mic, MicOff, Square } from 'lucide-react'
import { saveProfile } from './actions'
import { useDictation } from '@/lib/hooks/useDictation'

interface ProfileData {
  display_name: string
  role_title: string
  area: string
  bio: string
}

interface UserProfileFormProps {
  profile: ProfileData | null
}

export function UserProfileForm({ profile }: UserProfileFormProps) {
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [bio, setBio] = useState(profile?.bio || '')
  const dictation = useDictation()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('bio', bio)
    startTransition(async () => {
      setToast(null)
      const result = await saveProfile(formData)
      if (result.success) {
        setToast({ type: 'success', message: 'Perfil guardado' })
      } else {
        setToast({ type: 'error', message: result.error || 'Error al guardar' })
      }
      setTimeout(() => setToast(null), 4000)
    })
  }

  const handleDictation = () => {
    if (dictation.isRecording) {
      const text = dictation.confirm()
      if (text) {
        setBio(prev => prev ? `${prev} ${text}` : text)
      }
    } else {
      dictation.start()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 bg-gray-50/20">
          <h2 className="text-xl font-bold text-gray-900 font-display">
            Datos personales
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Tuqui usa tu nombre y cargo para personalizar respuestas
          </p>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre
              </label>
              <input
                type="text"
                name="display_name"
                defaultValue={profile?.display_name || ''}
                placeholder="Ej: Gonzalo Ruzafa"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-adhoc-violet focus:ring-2 focus:ring-adhoc-violet/20 outline-none text-gray-900 bg-gray-50/50 placeholder:text-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cargo
              </label>
              <input
                type="text"
                name="role_title"
                defaultValue={profile?.role_title || ''}
                placeholder="Ej: Director Comercial"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-adhoc-violet focus:ring-2 focus:ring-adhoc-violet/20 outline-none text-gray-900 bg-gray-50/50 placeholder:text-gray-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Área
            </label>
            <input
              type="text"
              name="area"
              defaultValue={profile?.area || ''}
              placeholder="Ej: Ventas, Administración, Dirección"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-adhoc-violet focus:ring-2 focus:ring-adhoc-violet/20 outline-none text-gray-900 bg-gray-50/50 placeholder:text-gray-300"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                Sobre vos
              </label>
              {dictation.isSupported && (
                <button
                  type="button"
                  onClick={handleDictation}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    dictation.isRecording
                      ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {dictation.isRecording ? (
                    <>
                      <Square className="w-3 h-3" />
                      Parar
                    </>
                  ) : (
                    <>
                      <Mic className="w-3 h-3" />
                      Dictar
                    </>
                  )}
                </button>
              )}
            </div>

            {dictation.isRecording && dictation.transcript && (
              <div className="mb-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 animate-pulse">
                🎤 {dictation.transcript}
              </div>
            )}

            <textarea
              name="bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Ej: Me enfoco en el seguimiento de clientes grandes y la rentabilidad. Quiero estar al tanto del stock y las cobranzas."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-adhoc-violet focus:ring-2 focus:ring-adhoc-violet/20 outline-none text-gray-900 bg-gray-50/50 placeholder:text-gray-300 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              💡 Esto se guarda en la memoria de Tuqui — aparece cuando es relevante, sin afectar todas las respuestas
            </p>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center justify-end gap-4">
        {toast && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-right-4 duration-300 ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            {toast.type === 'success' ? <Check className="w-4 h-4" /> : '⚠️'}
            {toast.message}
          </div>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-3 bg-adhoc-violet text-white rounded-xl font-semibold hover:bg-adhoc-violet/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar
        </button>
      </div>
    </form>
  )
}
