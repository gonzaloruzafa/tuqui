'use client'

import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { uploadDocument } from '@/app/admin/rag/actions'
import { useRef, useState } from 'react'

export function RAGUpload() {
    const formRef = useRef<HTMLFormElement>(null)
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')

    const handleUpload = async (formData: FormData) => {
        setStatus('uploading')
        setMessage('Procesando documento...')

        try {
            const result = await uploadDocument(formData)

            if (result.error) {
                setStatus('error')
                setMessage(result.error)
            } else {
                setStatus('success')
                setMessage(`Documento indexado: ${result.chunks} chunks creados`)
                formRef.current?.reset()
            }
        } catch (e: any) {
            setStatus('error')
            setMessage(e.message || 'Error desconocido')
        }

        // Reset status after a delay
        setTimeout(() => {
            setStatus('idle')
            setMessage('')
        }, 5000)
    }

    return (
        <div className="bg-white rounded-3xl border-2 border-dashed border-adhoc-lavender/40 p-10 text-center mb-10 hover:border-adhoc-violet/50 hover:bg-adhoc-lavender/5 transition-all group overflow-hidden relative">
            <form
                ref={formRef}
                action={handleUpload}
                className="flex flex-col items-center justify-center cursor-pointer"
            >
                <div className="w-20 h-20 bg-adhoc-lavender/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    {status === 'uploading' ? (
                        <Loader2 className="w-10 h-10 text-adhoc-violet animate-spin" />
                    ) : status === 'success' ? (
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    ) : status === 'error' ? (
                        <AlertCircle className="w-10 h-10 text-adhoc-coral" />
                    ) : (
                        <Upload className="w-10 h-10 text-adhoc-violet" />
                    )}
                </div>

                {status === 'idle' ? (
                    <>
                        <h3 className="text-xl font-bold text-gray-900 mb-2 font-display">Subir nuevos documentos</h3>
                        <p className="text-sm text-gray-400 mb-6 italic">Arrastra archivos aquí o haz clic para seleccionar (PDF, TXT, MD)</p>
                    </>
                ) : (
                    <p className={`text-base font-semibold mb-6 font-display ${status === 'error' ? 'text-adhoc-coral' :
                            status === 'success' ? 'text-green-600' :
                                'text-adhoc-violet'
                        }`}>
                        {message}
                    </p>
                )}

                <input
                    name="file"
                    type="file"
                    accept=".txt,.md,.csv,.json,.pdf"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    onChange={(e) => e.target.form?.requestSubmit()}
                    disabled={status === 'uploading'}
                />

                <div
                    className={`px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all shadow-md active:scale-95 ${status === 'uploading'
                            ? 'bg-gray-100 text-gray-400'
                            : 'bg-adhoc-violet text-white hover:bg-adhoc-violet/90 shadow-adhoc-violet/20'
                        }`}
                >
                    {status === 'uploading' ? 'Procesando...' : 'Seleccionar Archivo'}
                </div>
            </form>
        </div>
    )
}
