-- =============================================================================
-- RAG Documents Storage Bucket
-- Private bucket for uploading large documents (up to 50MB)
-- =============================================================================

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'rag-documents',
    'rag-documents',
    false,  -- Private bucket (requires signed URLs)
    52428800,  -- 50MB limit in bytes
    ARRAY['application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- RLS Policies for the bucket
-- =============================================================================

-- Policy: Service role can do anything (for server-side processing)
CREATE POLICY "Service role full access to rag-documents"
ON storage.objects
FOR ALL
USING (bucket_id = 'rag-documents')
WITH CHECK (bucket_id = 'rag-documents');

-- Note: Since we're using service role key for uploads and downloads,
-- we don't need complex user-based RLS policies. The server action
-- already verifies user is admin before allowing uploads.
