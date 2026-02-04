-- =============================================================================
-- Migration 130: Fix tool names and RAG configuration
-- =============================================================================
-- Issues found:
-- 1. meli_search doesn't exist as a tool (should be web_search)
-- 2. RAG tests failing because knowledge_base tool not properly configured
-- 3. Some agents still have old tool names
-- =============================================================================

-- =============================================================================
-- 1. FIX MASTER_AGENTS - Replace meli_search with web_search
-- =============================================================================
UPDATE master_agents
SET
    tools = array_replace(tools, 'meli_search', 'web_search'),
    version = version + 1,
    updated_at = NOW()
WHERE 'meli_search' = ANY(tools);

-- =============================================================================
-- 2. FIX MASTER_AGENTS - Add knowledge_base to agents with rag_enabled
-- =============================================================================
UPDATE master_agents
SET
    tools = CASE
        WHEN NOT ('knowledge_base' = ANY(tools)) THEN tools || ARRAY['knowledge_base']
        ELSE tools
    END,
    version = version + 1,
    updated_at = NOW()
WHERE rag_enabled = true
  AND NOT ('knowledge_base' = ANY(tools));

-- =============================================================================
-- 3. FIX AGENTS TABLE - Same fixes for tenant-specific agents
-- =============================================================================
UPDATE agents
SET
    tools = array_replace(tools, 'meli_search', 'web_search'),
    updated_at = NOW()
WHERE 'meli_search' = ANY(tools);

UPDATE agents
SET
    tools = CASE
        WHEN NOT ('knowledge_base' = ANY(tools)) THEN tools || ARRAY['knowledge_base']
        ELSE tools
    END,
    updated_at = NOW()
WHERE rag_enabled = true
  AND NOT ('knowledge_base' = ANY(tools));

-- =============================================================================
-- 4. SYNC AGENTS FROM MASTERS
-- =============================================================================
SELECT sync_agents_from_masters();

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
DECLARE
    meli_search_count INT;
    rag_without_kb INT;
BEGIN
    -- Check no meli_search remains
    SELECT COUNT(*) INTO meli_search_count
    FROM master_agents
    WHERE 'meli_search' = ANY(tools);
    
    IF meli_search_count > 0 THEN
        RAISE WARNING 'Still have % agents with meli_search', meli_search_count;
    END IF;

    -- Check all rag_enabled have knowledge_base
    SELECT COUNT(*) INTO rag_without_kb
    FROM master_agents
    WHERE rag_enabled = true
      AND NOT ('knowledge_base' = ANY(tools));
    
    IF rag_without_kb > 0 THEN
        RAISE WARNING 'Still have % rag_enabled agents without knowledge_base', rag_without_kb;
    END IF;

    RAISE NOTICE '✅ Migration 130 completed: meli_search → web_search, RAG → knowledge_base';
END $$;
