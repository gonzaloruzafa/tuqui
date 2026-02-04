'use client'

import { useState } from 'react'
import { Key, CheckCircle, AlertCircle } from 'lucide-react'
import { adminSetPassword } from '../actions'

interface PasswordResetFormProps {
    userId: string
}

export function PasswordResetForm({ userId }: PasswordResetFormProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')

    async function handleSubmit(formData: FormData) {
        setStatus('loading')
        setMessage('')

        try {
            await adminSetPassword(userId, formData)
            setStatus('success')
            setMessage('Contraseña actualizada correctamente')
            // Reset form
            const form = document.getElementById('password-form') as HTMLFormElement
            form?.reset()
        } catch (error: any) {
            setStatus('error')
            setMessage(error.message || 'Error al cambiar la contraseña')
        }
    }

    return (
        <form id="password-form" action={handleSubmit} className="p-6 space-y-4">
            {status === 'success' && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    {message}
                </div>
            )}

            {status === 'error' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {message}
                </div>
            )}

            <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Nueva Contraseña
                </label>
                <input
                    type="password"
                    name="password"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Confirmar Contraseña
                </label>
                <input
                    type="password"
                    name="confirm_password"
                    required
                    minLength={6}
                    placeholder="Repetí la contraseña"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                />
            </div>

            <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-amber-500 text-white font-medium py-3 px-4 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                <Key className="w-4 h-4" />
                {status === 'loading' ? 'Guardando...' : 'Establecer Contraseña'}
            </button>
        </form>
    )
}
