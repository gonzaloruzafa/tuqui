'use client'

import { Save, Loader2, Check } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { useEffect, useState, useRef } from 'react'

interface SaveButtonProps {
    className?: string
    label?: string
    fullWidth?: boolean
}

export function SaveButton({ className = '', label = 'Guardar Cambios', fullWidth = false }: SaveButtonProps) {
    const { pending } = useFormStatus()
    const [showSuccess, setShowSuccess] = useState(false)
    const wasSubmitting = useRef(false)

    useEffect(() => {
        // Detect when submission completes (pending goes from true to false)
        if (wasSubmitting.current && !pending) {
            setShowSuccess(true)
            const timer = setTimeout(() => setShowSuccess(false), 2500)
            return () => clearTimeout(timer)
        }
        wasSubmitting.current = pending
    }, [pending])

    return (
        <button 
            type="submit" 
            disabled={pending}
            className={`flex items-center justify-center gap-3 font-semibold px-10 py-4 rounded-2xl transition-all shadow-lg disabled:opacity-70 text-base ${
                showSuccess 
                    ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25' 
                    : 'bg-adhoc-violet hover:bg-adhoc-violet/90 shadow-adhoc-violet/25'
            } text-white ${fullWidth ? 'w-full' : ''} ${className}`}
        >
            {pending ? (
                <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                </>
            ) : showSuccess ? (
                <>
                    <Check className="w-5 h-5" />
                    ¡Guardado correctamente!
                </>
            ) : (
                <>
                    <Save className="w-5 h-5" />
                    {label}
                </>
            )}
        </button>
    )
}
