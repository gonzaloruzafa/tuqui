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

    const processOneFile = async (file: File, prefix: string) => {
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`${file.name}: muy grande (${(file.size / 1024 / 1024).toFixed(1)}MB > 50MB)`)
        }

        setStatus('uploading')
        setMessage(`${prefix}Preparando ${file.name}...`)

        const urlResult = await getUploadSignedUrl(file.name)
        if (urlResult.error || !urlResult.signedUrl) {
            throw new Error(`${file.name}: ${urlResult.error || 'No se pudo generar URL'}`)
        }

        setMessage(`${prefix}Subiendo ${file.name}...`)
        const { error: uploadError } = await uploadWithSignedUrl(urlResult.signedUrl, file)
        if (uploadError) throw new Error(`${file.name}: ${uploadError}`)

        setStatus('processing')
        setMessage(`${prefix}Procesando ${file.name}...`)

        const result = await processDocumentFromStorage({
            storagePath: urlResult.path!,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
        })
        if (result.error) throw new Error(`${file.name}: ${result.error}`)
        return result.chunks || 0
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        const fileList = Array.from(files)
        const total = fileList.length
        let successCount = 0
        let totalChunks = 0
        const errors: string[] = []

        setProgress(5)

        for (let i = 0; i < total; i++) {
            const prefix = total > 1 ? `[${i + 1}/${total}] ` : ''
            try {
                const chunks = await processOneFile(fileList[i], prefix)
                totalChunks += chunks
                successCount++
                setProgress(Math.round(((i + 1) / total) * 100))
            } catch (err: any) {
                errors.push(err.message)
            }
        }

        if (successCount > 0) {
            setStatus('success')
            setMessage(`${successCount} documento${successCount > 1 ? 's' : ''} indexado${successCount > 1 ? 's' : ''}: ${totalChunks} chunks`)
            setProgress(100)
            formRef.current?.reset()
        }
        if (errors.length > 0) {
            setStatus('error')
            setMessage(errors.join(' | '))
        }

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
                    multiple
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
                     'Seleccionar Archivos'}
                </div>
            </form>
        </div>
    )
}
