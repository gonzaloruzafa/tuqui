'use client'

import { useRef, useState, useTransition } from 'react'
import { Save, Loader2, Check, Eye } from 'lucide-react'
import { saveCompanyContext } from '@/app/admin/company/actions'

interface Preview {
  context: string
  tokenEstimate: number
  sources: string[]
}

interface CompanyFormProps {
  children: React.ReactNode
  initialPreview: Preview
}

export function CompanyForm({ children, initialPreview }: CompanyFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [preview, setPreview] = useState<Preview>(initialPreview)

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      setToast(null)
      const result = await saveCompanyContext(formData)

      if (result.success) {
        setToast({ type: 'success', message: 'Cambios guardados correctamente' })
        if (result.preview) setPreview(result.preview)
      } else {
        setToast({ type: 'error', message: result.error || 'Error al guardar' })
      }

      setTimeout(() => setToast(null), 4000)
    })
  }

  return (
    <>
      <form ref={formRef} action={handleSubmit} className="space-y-8">
        {children}

        {/* PREVIEW SECTION */}
        <section className="bg-white rounded-3xl border border-adhoc-lavender/30 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-50 bg-gray-50/20">
            <h2 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
              <Eye className="w-5 h-5 text-adhoc-violet" />
              Así ve Tuqui a tu empresa
            </h2>
            <p className="text-sm text-gray-500 mt-1 italic">
              ~{preview.tokenEstimate} tokens · Fuentes: {preview.sources.join(', ') || 'ninguna'}
            </p>
          </div>
          <div className="p-8">
            {preview.context ? (
              <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 border border-gray-100 rounded-xl p-6 text-gray-700 leading-relaxed">
                {preview.context}
              </pre>
            ) : (
              <p className="text-sm text-gray-400 italic text-center py-6">
                Completá los datos de arriba para que Tuqui conozca tu empresa
              </p>
            )}
          </div>
        </section>

        {/* SAVE BUTTON */}
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
            className="flex items-center gap-2 bg-adhoc-violet hover:bg-adhoc-violet/90 disabled:bg-adhoc-violet/60 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-md shadow-adhoc-violet/20 active:scale-95 disabled:active:scale-100"
          >
            {isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="w-4 h-4" /> Guardar cambios</>
            )}
          </button>
        </div>
      </form>
    </>
  )
}
