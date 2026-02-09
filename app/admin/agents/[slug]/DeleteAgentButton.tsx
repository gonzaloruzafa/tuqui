'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle } from 'lucide-react'
import { deleteAgent } from './actions'

interface DeleteAgentButtonProps {
    agentId: string
    agentName: string
}

export function DeleteAgentButton({ agentId, agentName }: DeleteAgentButtonProps) {
    const router = useRouter()
    const [showConfirm, setShowConfirm] = useState(false)
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
    const [error, setError] = useState('')

    async function handleDelete() {
        setStatus('loading')
        setError('')

        try {
            const result = await deleteAgent(agentId)
            if (result?.error) {
                setStatus('error')
                setError(result.error)
                return
            }
            router.push('/admin/agents')
        } catch (e: any) {
            setStatus('error')
            setError(e.message || 'Error al eliminar agente')
        }
    }

    if (!showConfirm) {
        return (
            <button
                onClick={() => setShowConfirm(true)}
                className="w-full bg-red-50 text-red-600 font-medium py-3 px-4 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
                <Trash2 className="w-4 h-4" />
                Eliminar Agente
            </button>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="font-medium text-red-900">¿Estás seguro?</p>
                    <p className="text-sm text-red-700 mt-1">
                        Se eliminará permanentemente el agente <strong>{agentName}</strong> y todas sus conversaciones.
                        Esta acción no se puede deshacer.
                    </p>
                </div>
            </div>

            {status === 'error' && (
                <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-3">
                <button
                    onClick={() => setShowConfirm(false)}
                    disabled={status === 'loading'}
                    className="flex-1 bg-gray-100 text-gray-700 font-medium py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleDelete}
                    disabled={status === 'loading'}
                    className="flex-1 bg-red-600 text-white font-medium py-3 px-4 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {status === 'loading' ? (
                        'Eliminando...'
                    ) : (
                        <>
                            <Trash2 className="w-4 h-4" />
                            Confirmar
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
