'use client'

import { Upload } from 'lucide-react'
import { uploadDocument } from '@/app/admin/rag/actions'
import { useRef } from 'react'

export function RAGUpload() {
    const formRef = useRef<HTMLFormElement>(null)

    return (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center mb-8 hover:border-adhoc-violet transition-colors group">
            <form
                ref={formRef}
                action={async (formData) => {
                    await uploadDocument(formData)
                    formRef.current?.reset()
                }}
                className="flex flex-col items-center justify-center cursor-pointer relative"
            >
                <div className="w-16 h-16 bg-adhoc-lavender/30 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-adhoc-violet" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Subir nuevos documentos</h3>
                <p className="text-sm text-gray-500 mb-4">Soporta .pdf, .txt, .md, .csv</p>

                <input
                    name="file"
                    type="file"
                    accept=".txt,.md,.csv,.json,.pdf"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    onChange={(e) => e.target.form?.requestSubmit()}
                />
                <button className="bg-adhoc-violet text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-adhoc-violet/90 pointer-events-none">
                    Seleccionar Archivo
                </button>
            </form>
        </div>
    )
}
