-- =============================================================================
-- CUSTOM INSTRUCTIONS: Add support for tenant-specific instructions on base agents
-- =============================================================================

-- Add custom_instructions column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agents' AND column_name = 'custom_instructions'
    ) THEN
        ALTER TABLE agents ADD COLUMN custom_instructions TEXT;
        COMMENT ON COLUMN agents.custom_instructions IS 'Tenant-specific instructions that are appended to the master agent system_prompt';
    END IF;
END $$;

-- Add last_synced_at column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agents' AND column_name = 'last_synced_at'
    ) THEN
        ALTER TABLE agents ADD COLUMN last_synced_at TIMESTAMPTZ;
        COMMENT ON COLUMN agents.last_synced_at IS 'Timestamp of last sync with master_agent';
    END IF;
END $$;

-- =============================================================================
-- Update sync function to PRESERVE custom_instructions
-- =============================================================================
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
    -- Loop through all tenants
    FOR v_tenant IN SELECT t.id, t.name FROM tenants t LOOP
        v_count := 0;
        
        -- For each tenant, sync all agents that have a master
        -- IMPORTANT: DO NOT update custom_instructions - that's tenant-specific
        UPDATE agents a
        SET 
            system_prompt = m.system_prompt,
            welcome_message = COALESCE(a.welcome_message, m.welcome_message),
            placeholder_text = COALESCE(a.placeholder_text, m.placeholder_text),
            tools = m.tools,
            rag_enabled = m.rag_enabled,
            keywords = m.keywords,
            master_version_synced = m.version,
            last_synced_at = now(),
            updated_at = now()
        FROM master_agents m
        WHERE a.master_agent_id = m.id
          AND a.tenant_id = v_tenant.id
          AND a.master_version_synced < m.version;
        
        v_count := 0;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        
        -- Also instantiate any new master agents that tenant doesn't have yet
        INSERT INTO agents (
            tenant_id,
            master_agent_id,
            slug,
            name,
            description,
            icon,
            color,
            is_active,
            rag_enabled,
            system_prompt,
            welcome_message,
            placeholder_text,
            tools,
            keywords,
            master_version_synced,
            last_synced_at
        )
        SELECT 
            v_tenant.id,
            m.id,
            m.slug,
            m.name,
            m.description,
            m.icon,
            m.color,
            true,
            m.rag_enabled,
            m.system_prompt,
            m.welcome_message,
            m.placeholder_text,
            m.tools,
            m.keywords,
            m.version,
            now()
        FROM master_agents m
        WHERE m.is_published = true
          AND NOT EXISTS (
              SELECT 1 FROM agents a 
              WHERE a.tenant_id = v_tenant.id 
                AND a.master_agent_id = m.id
          );
        
        GET DIAGNOSTICS v_insert_count = ROW_COUNT;
        v_count := v_count + v_insert_count;
        
        -- Return row for this tenant
        tenant_id := v_tenant.id;
        tenant_name := v_tenant.name;
        agents_synced := v_count;
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Placeholder for future: master_documents table for shared RAG
-- (Not implementing now, but schema is ready)
-- =============================================================================
-- CREATE TABLE IF NOT EXISTS master_documents (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     title TEXT NOT NULL,
--     content TEXT,
--     embedding VECTOR(768),
--     metadata JSONB DEFAULT '{}',
--     category TEXT,  -- 'legal', 'contable', 'fiscal', etc.
--     created_at TIMESTAMPTZ DEFAULT now(),
--     updated_at TIMESTAMPTZ DEFAULT now()
-- );
-- 
-- CREATE TABLE IF NOT EXISTS master_agent_documents (
--     master_agent_id UUID REFERENCES master_agents(id) ON DELETE CASCADE,
--     document_id UUID REFERENCES master_documents(id) ON DELETE CASCADE,
--     PRIMARY KEY (master_agent_id, document_id)
-- );
