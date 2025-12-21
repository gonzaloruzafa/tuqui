'use server'

import { auth } from '@/lib/auth/config'
import { getTenantClient } from '@/lib/supabase/tenant'
import { revalidatePath } from 'next/cache'

export async function uploadDocument(formData: FormData) {
    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) return

    const file = formData.get('file') as File
    if (!file) return

    // 1. Read file
    let content = ''

    if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        // Use standard require for server-side PDF parsing
        const pdfParse = require('pdf-parse')
        const data = await pdfParse(buffer)
        content = data.text
    } else {
        content = await file.text()
    }

    if (!content) return

    const db = await getTenantClient(session.tenant.id)

    // 2. Insert into documents
    const { error } = await db.from('documents').insert({
        content: content,
        metadata: { filename: file.name, type: file.type, size: file.size }
    })

    if (error) {
        console.error("Upload error", error)
        return
    }

    revalidatePath('/admin/rag')
}

export async function deleteDocument(formData: FormData) {
    const id = formData.get('id') as string
    const session = await auth()
    if (!session?.tenant?.id || !session.isAdmin) return

    const db = await getTenantClient(session.tenant.id)
    await db.from('documents').delete().eq('id', id)
    revalidatePath('/admin/rag')
}
