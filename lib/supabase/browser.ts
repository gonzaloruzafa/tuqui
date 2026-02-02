/**
 * Supabase Storage helpers for RAG document uploads
 * 
 * Uses a two-step process:
 * 1. Get signed upload URL from server (via server action)
 * 2. Upload directly to Storage using the signed URL
 */

/**
 * Upload a file using a pre-signed URL
 * This bypasses the anon key restriction for private buckets
 */
export async function uploadWithSignedUrl(
    signedUrl: string,
    file: File
): Promise<{ error: string | null }> {
    try {
        const response = await fetch(signedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type,
            },
            body: file
        })

        if (!response.ok) {
            const text = await response.text()
            console.error('[Storage] Upload failed:', response.status, text)
            return { error: `Upload failed: ${response.statusText}` }
        }

        console.log('[Storage] File uploaded successfully')
        return { error: null }
    } catch (e: any) {
        console.error('[Storage] Upload error:', e)
        return { error: e.message || 'Upload failed' }
    }
}
