-- =============================================================================
-- Migration 131: Fix RAG document visibility + Rename to Tuqui
-- =============================================================================

-- ============================================
-- 1. Make Cingol documents globally accessible
-- ============================================
-- Documents with "cingol" in title should be accessible by all agents
-- This fixes RAG tests that run with 'tuqui' agent but docs are assigned to 'cedent'

UPDATE documents
SET is_global = true
WHERE title ILIKE '%cingol%'
  AND is_global IS NOT TRUE;

-- Also link Cingol documents to tuqui agent via agent_documents
-- This ensures tuqui can access them even if is_global is reset later
INSERT INTO agent_documents (tenant_id, agent_id, document_id)
SELECT 
    d.tenant_id,
    a.id as agent_id,
    d.id as document_id
FROM documents d
CROSS JOIN agents a
WHERE d.title ILIKE '%cingol%'
  AND a.slug = 'tuqui'
  AND NOT EXISTS (
    SELECT 1 FROM agent_documents ad 
    WHERE ad.agent_id = a.id 
      AND ad.document_id = d.id
      AND ad.tenant_id = d.tenant_id
  );

-- ============================================
-- 2. Update app_settings for rename (if exists)
-- ============================================
-- No changes needed - app name comes from code/env, not DB
