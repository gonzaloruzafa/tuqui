'use client'

import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { processDocumentFromStorage, getUploadSignedUrl } from '@/app/admin/rag/actions'
import { uploadWithSignedUrl } from '@/lib/supabase/browser'
import { useRef, useState } from 'react'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function RAGUpload() {
    const formRef = useRef<HTMLFormElement>(null)
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')
    const [progress, setProgress] = useState(0)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            setStatus('error')
            setMessage(`El archivo es muy grande. Máximo: 50MB (archivo: ${(file.size / 1024 / 1024).toFixed(1)}MB)`)
            setTimeout(() => { setStatus('idle'); setMessage('') }, 5000)
            return
        }

        try {
            // Step 1: Get signed upload URL from server
            setStatus('uploading')
            setMessage('Preparando upload...')
            setProgress(10)

            const urlResult = await getUploadSignedUrl(file.name)
            if (urlResult.error || !urlResult.signedUrl) {
                setStatus('error')
                setMessage(`Error: ${urlResult.error || 'No se pudo generar URL'}`)
                setTimeout(() => { setStatus('idle'); setMessage('') }, 5000)
                return
            }

            // Step 2: Upload directly to Storage
            setMessage('Subiendo archivo...')
            setProgress(30)

            const { error: uploadError } = await uploadWithSignedUrl(urlResult.signedUrl, file)
            
            if (uploadError) {
                setStatus('error')
                setMessage(`Error subiendo: ${uploadError}`)
                setTimeout(() => { setStatus('idle'); setMessage('') }, 5000)
                return
            }

            // Step 3: Process document (extract text, chunk, embed)
            setStatus('processing')
            setMessage('Procesando documento...')
            setProgress(60)

            const result = await processDocumentFromStorage({
                storagePath: urlResult.path!,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size
            })

            if (result.error) {
                setStatus('error')
                setMessage(result.error)
            } else {
                setStatus('success')
                setMessage(`Documento indexado: ${result.chunks} chunks creados`)
                setProgress(100)
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
            setProgress(0)
        }, 5000)
    }

    return (
        <div className="bg-white rounded-3xl border-2 border-dashed border-adhoc-lavender/40 p-10 text-center mb-10 hover:border-adhoc-violet/50 hover:bg-adhoc-lavender/5 transition-all group overflow-hidden relative">
            <form
                ref={formRef}
                className="flex flex-col items-center justify-center cursor-pointer"
            >
                <div className="w-20 h-20 bg-adhoc-lavender/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    {status === 'uploading' || status === 'processing' ? (
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
                        <p className="text-sm text-gray-400 mb-6 italic">Archivos hasta 50MB (PDF, TXT, MD)</p>
                    </>
                ) : (
                    <>
                        <p className={`text-base font-semibold mb-2 font-display ${status === 'error' ? 'text-adhoc-coral' :
                                status === 'success' ? 'text-green-600' :
                                    'text-adhoc-violet'
                            }`}>
                            {message}
                        </p>
                        {(status === 'uploading' || status === 'processing') && (
                            <div className="w-48 h-2 bg-gray-200 rounded-full mb-4 overflow-hidden">
                                <div 
                                    className="h-full bg-adhoc-violet transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                    </>
                )}

                <input
                    name="file"
                    type="file"
                    accept=".txt,.md,.csv,.json,.pdf"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    onChange={handleFileChange}
                    disabled={status === 'uploading' || status === 'processing'}
                />

                <div
                    className={`px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all shadow-md active:scale-95 ${status === 'uploading' || status === 'processing'
                            ? 'bg-gray-100 text-gray-400'
                            : 'bg-adhoc-violet text-white hover:bg-adhoc-violet/90 shadow-adhoc-violet/20'
                        }`}
                >
                    {status === 'uploading' ? 'Subiendo...' : 
                     status === 'processing' ? 'Procesando...' : 
                     'Seleccionar Archivo'}
                </div>
            </form>
        </div>
    )
}
