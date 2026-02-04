'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { deleteDocument } from '@/app/admin/rag/actions'

function DeleteButton() {
    const { pending } = useFormStatus()
    
    return (
        <button 
            type="submit" 
            disabled={pending}
            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed" 
            title="Eliminar documento"
        >
            {pending ? (
                <Loader2 className="w-4 h-4 animate-spin text-red-400" />
            ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
            )}
        </button>
    )
}

export function DeleteDocumentForm({ documentId }: { documentId: string }) {
    return (
        <form action={deleteDocument}>
            <input type="hidden" name="id" value={documentId} />
            <DeleteButton />
        </form>
    )
}
