-- =============================================================================
-- FIX: match_documents + sync_agents_from_masters — cleanup rag_enabled
-- =============================================================================
-- Migration: 209_fix_match_documents.sql
-- Parte de F7: Master Agents + RAG Centralizado
--
-- Fixes:
--   1. match_documents(): elimina check de rag_enabled (dropeado en 202),
--      agrega UNION con master_document_chunks para buscar docs centralizados
--   2. sync_agents_from_masters(): elimina referencias a rag_enabled
-- =============================================================================

-- 1. Reescribir match_documents con UNION tenant + master docs
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(768),
    match_agent_id UUID,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 5
)
RETURNS TABLE (id UUID, content TEXT, similarity FLOAT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant context not set';
    END IF;

    RETURN QUERY

    -- Docs propios del tenant
    SELECT dc.id, dc.content,
           (1 - (dc.embedding <=> query_embedding))::FLOAT AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.tenant_id = v_tenant_id
      AND 1 - (dc.embedding <=> query_embedding) > match_threshold
      AND (
          d.is_global = true
          OR d.agent_id = match_agent_id
          OR EXISTS (
              SELECT 1 FROM agent_documents ad
              WHERE ad.agent_id = match_agent_id
                AND ad.document_id = d.id
                AND ad.tenant_id = v_tenant_id
          )
      )

    UNION ALL

    -- Docs centralizados del master agent (sin copiar, query directo)
    SELECT mdc.id, mdc.content,
           (1 - (mdc.embedding <=> query_embedding))::FLOAT AS similarity
    FROM master_document_chunks mdc
    JOIN master_agent_documents mad ON mad.document_id = mdc.document_id
    JOIN agents a ON a.master_agent_id = mad.master_agent_id
    WHERE a.id = match_agent_id
      AND a.tenant_id = v_tenant_id
      AND 1 - (mdc.embedding <=> query_embedding) > match_threshold

    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- 2. Reescribir sync_agents_from_masters sin rag_enabled
CREATE OR REPLACE FUNCTION sync_agents_from_masters() RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    agents_synced INT
) AS $$
DECLARE
    v_tenant RECORD;
    v_count INT;
    v_insert_count INT;
BEGIN
    FOR v_tenant IN SELECT t.id, t.name FROM tenants t LOOP
        v_count := 0;

        -- Sync existing agents where master has newer version
        UPDATE agents a
        SET
            system_prompt = m.system_prompt,
            description = m.description,
            welcome_message = COALESCE(a.welcome_message, m.welcome_message),
            placeholder_text = COALESCE(a.placeholder_text, m.placeholder_text),
            tools = m.tools,
            master_version_synced = m.version,
            updated_at = now()
        FROM master_agents m
        WHERE a.master_agent_id = m.id
          AND a.tenant_id = v_tenant.id
          AND a.master_version_synced < m.version;

        GET DIAGNOSTICS v_count = ROW_COUNT;

        -- Instantiate new master agents not yet in this tenant
        INSERT INTO agents (
            tenant_id, master_agent_id, slug, name, description,
            icon, color, is_active, system_prompt,
            welcome_message, placeholder_text, tools, master_version_synced
        )
        SELECT
            v_tenant.id, m.id, m.slug, m.name, m.description,
            m.icon, m.color, true, m.system_prompt,
            m.welcome_message, m.placeholder_text, m.tools, m.version
        FROM master_agents m
        WHERE m.is_published = true
          AND NOT EXISTS (
              SELECT 1 FROM agents a
              WHERE a.tenant_id = v_tenant.id
                AND a.master_agent_id = m.id
          );

        GET DIAGNOSTICS v_insert_count = ROW_COUNT;
        v_count := v_count + v_insert_count;

        tenant_id := v_tenant.id;
        tenant_name := v_tenant.name;
        agents_synced := v_count;
        RETURN NEXT;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql;
