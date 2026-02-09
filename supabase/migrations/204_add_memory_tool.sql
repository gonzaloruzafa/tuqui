-- Migration 204: Add memory tool to all master agents
--
-- Enables recall_memory and save_memory for all agents.
-- Users can save notes about entities and recall them in future conversations.

-- Add 'memory' to master_agents that don't have it yet
UPDATE master_agents
SET
    tools = CASE
        WHEN NOT ('memory' = ANY(tools)) THEN tools || ARRAY['memory']
        ELSE tools
    END,
    version = version + 1,
    updated_at = NOW()
WHERE NOT ('memory' = ANY(tools));

-- Also sync to tenant agents
UPDATE agents
SET
    tools = CASE
        WHEN NOT ('memory' = ANY(tools)) THEN tools || ARRAY['memory']
        ELSE tools
    END,
    updated_at = NOW()
WHERE NOT ('memory' = ANY(tools));

-- Log
DO $$
BEGIN
    RAISE NOTICE 'Migration 204: Added memory tool to all agents';
END $$;
