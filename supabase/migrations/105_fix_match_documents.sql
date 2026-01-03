-- =============================================================================
-- FIX: match_documents ambiguous column reference
-- The error was: column reference "id" is ambiguous
-- =============================================================================

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(768),
    match_agent_id UUID,
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_rag_enabled BOOLEAN;
    v_rag_strict BOOLEAN;
BEGIN
    -- Get current tenant from context
    v_tenant_id := current_tenant_id();
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant context not set';
    END IF;
    
    -- Check agent settings
    SELECT a.rag_enabled, a.rag_strict 
    INTO v_rag_enabled, v_rag_strict 
    FROM agents a
    WHERE a.id = match_agent_id AND a.tenant_id = v_tenant_id;
    
    -- If RAG not enabled, return empty
    IF v_rag_enabled IS NOT TRUE THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        dc.id AS id,
        dc.content AS content,
        (1 - (dc.embedding <=> query_embedding))::FLOAT AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.tenant_id = v_tenant_id
      AND 1 - (dc.embedding <=> query_embedding) > match_threshold
      AND (
        -- Strict mode: only docs assigned to this agent or linked
        CASE WHEN v_rag_strict = true THEN
            d.agent_id = match_agent_id
            OR EXISTS (
                SELECT 1 FROM agent_documents ad 
                WHERE ad.agent_id = match_agent_id 
                  AND ad.document_id = d.id
                  AND ad.tenant_id = v_tenant_id
            )
        -- Normal mode: global docs + assigned + linked
        ELSE
            d.is_global = true
            OR d.agent_id = match_agent_id
            OR EXISTS (
                SELECT 1 FROM agent_documents ad 
                WHERE ad.agent_id = match_agent_id 
                  AND ad.document_id = d.id
                  AND ad.tenant_id = v_tenant_id
            )
        END
      )
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
