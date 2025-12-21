'use client'

import { Save, Loader2, Check } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { useEffect, useState, useRef } from 'react'

interface SaveButtonProps {
    className?: string
    label?: string
}

export function SaveButton({ className = '', label = 'Guardar Cambios' }: SaveButtonProps) {
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
            className={`flex items-center gap-2 font-medium px-8 py-3 rounded-lg transition-all shadow-lg disabled:opacity-70 ${
                showSuccess 
                    ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' 
                    : 'bg-adhoc-violet hover:bg-adhoc-violet/90 shadow-adhoc-violet/20'
            } text-white ${className}`}
        >
            {pending ? (
                <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                </>
            ) : showSuccess ? (
                <>
                    <Check className="w-5 h-5" />
                    ¡Guardado!
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
