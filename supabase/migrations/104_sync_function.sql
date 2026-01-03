-- =============================================================================
-- SYNC AGENTS FROM MASTERS: Function to sync all tenant agents with their masters
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Function to sync ALL agents across ALL tenants with their masters
-- This is called from the super-admin panel to push updates
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_agents_from_masters() RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    agents_synced INT
) AS $$
DECLARE
    v_tenant RECORD;
    v_count INT;
BEGIN
    -- Loop through all tenants
    FOR v_tenant IN SELECT t.id, t.name FROM tenants t LOOP
        v_count := 0;
        
        -- For each tenant, sync all agents that have a master
        UPDATE agents a
        SET 
            system_prompt = m.system_prompt,
            welcome_message = COALESCE(a.welcome_message, m.welcome_message),
            placeholder_text = COALESCE(a.placeholder_text, m.placeholder_text),
            tools = m.tools,
            rag_enabled = m.rag_enabled,
            master_version_synced = m.version,
            updated_at = now()
        FROM master_agents m
        WHERE a.master_agent_id = m.id
          AND a.tenant_id = v_tenant.id
          AND a.master_version_synced < m.version;
        
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
            master_version_synced
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
            m.version
        FROM master_agents m
        WHERE m.is_published = true
          AND NOT EXISTS (
              SELECT 1 FROM agents a 
              WHERE a.tenant_id = v_tenant.id 
                AND a.master_agent_id = m.id
          );
        
        GET DIAGNOSTICS v_count = v_count + ROW_COUNT;
        
        -- Return row for this tenant
        tenant_id := v_tenant.id;
        tenant_name := v_tenant.name;
        agents_synced := v_count;
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Update master_agents.tools to include both tavily and firecrawl by default
-- -----------------------------------------------------------------------------
UPDATE master_agents 
SET tools = ARRAY['tavily', 'firecrawl']
WHERE slug = 'tuqui';

-- Also update existing agents with Tuqui master to have both tools
UPDATE agents a
SET tools = ARRAY['tavily', 'firecrawl']
FROM master_agents m
WHERE a.master_agent_id = m.id
  AND m.slug = 'tuqui';
