-- Fix: sync also propagates slug, name, icon to tenant agents
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
            slug = m.slug,
            name = m.name,
            icon = m.icon,
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
