-- =============================================================================
-- MASTER DOCUMENTS: Docs centralizados a nivel plataforma (sin tenant_id)
-- =============================================================================
-- Migration: 208_master_documents.sql
-- Parte de F7: Master Agents + RAG Centralizado
--
-- Crea 3 tablas:
--   1. master_documents       — documentos a nivel plataforma
--   2. master_document_chunks — chunks con embeddings (vector 768)
--   3. master_agent_documents — M2M: qué docs tiene cada master agent
--
-- Sin IVFFlat index por ahora — se agrega cuando haya >1000 chunks
-- =============================================================================

-- 1. Documentos a nivel plataforma (sin tenant_id)
CREATE TABLE IF NOT EXISTS master_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_type TEXT DEFAULT 'file',     -- 'file', 'manual', 'url'
    file_name TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Chunks con embeddings (sin tenant_id) — ÚNICA copia de vectores
CREATE TABLE IF NOT EXISTS master_document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES master_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(768),
    chunk_index INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index básico para búsqueda por document_id (no IVFFlat todavía)
CREATE INDEX IF NOT EXISTS idx_master_doc_chunks_document
    ON master_document_chunks(document_id);

-- 3. M2M: qué documentos tiene cada master agent
CREATE TABLE IF NOT EXISTS master_agent_documents (
    master_agent_id UUID NOT NULL REFERENCES master_agents(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES master_documents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (master_agent_id, document_id)
);
