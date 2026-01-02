-- =============================================================================
-- TUQUI AGENTS - UNIFIED SCHEMA WITH RLS
-- =============================================================================
-- Migration: 100_unified_schema.sql
-- Description: Single-database multi-tenant schema with Row Level Security
-- Created: 2026-01-02
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_cron";  -- Para Prometeo scheduled tasks

-- =============================================================================
-- HELPER FUNCTIONS FOR RLS
-- =============================================================================

-- Function to set tenant context for current session
-- Called at the beginning of each request
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM set_config('app.tenant_id', p_tenant_id::text, false);
END;
$$;

-- Function to get current tenant from session
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.tenant_id', true), '')::UUID;
$$;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TENANTS: Each company/organization using the platform
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,                    -- URL-friendly identifier
    name TEXT NOT NULL,                           -- Display name
    
    -- Company metadata (moved from separate company_info table)
    company_name TEXT,
    industry TEXT,
    description TEXT,
    tone_of_voice TEXT,
    website TEXT,
    company_context TEXT,                         -- Additional context for AI
    
    -- Twilio WhatsApp config
    twilio_phone TEXT,                            -- WhatsApp number for this tenant
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_twilio_phone ON tenants(twilio_phone);

-- -----------------------------------------------------------------------------
-- USERS: People who can access the platform
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    email TEXT NOT NULL,
    name TEXT,
    image TEXT,
    
    -- Permissions
    is_admin BOOLEAN DEFAULT false,
    
    -- WhatsApp linking
    whatsapp_phone TEXT,                          -- For linking WhatsApp user to web user
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_whatsapp ON users(whatsapp_phone);

-- -----------------------------------------------------------------------------
-- INTEGRATIONS: Third-party service connections per tenant
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL,                           -- 'odoo', 'mercadolibre', 'twilio', 'tavily'
    config JSONB DEFAULT '{}',                    -- Encrypted credentials
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    UNIQUE(tenant_id, type)
);

CREATE INDEX idx_integrations_tenant ON integrations(tenant_id);
CREATE INDEX idx_integrations_type ON integrations(type);

-- =============================================================================
-- AGENT SYSTEM
-- =============================================================================

-- -----------------------------------------------------------------------------
-- AGENTS: AI agent configurations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    slug TEXT NOT NULL,                           -- URL-friendly identifier
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'Bot',
    color TEXT DEFAULT 'blue',
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
    rag_enabled BOOLEAN DEFAULT false,
    rag_strict BOOLEAN DEFAULT false,             -- Only use assigned docs, not global
    
    -- Prompts
    system_prompt TEXT,
    welcome_message TEXT,
    placeholder_text TEXT,
    
    -- Tools enabled (array of tool slugs)
    tools TEXT[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_agents_tenant ON agents(tenant_id);
CREATE INDEX idx_agents_slug ON agents(slug);

-- -----------------------------------------------------------------------------
-- AGENT_TOOLS: Tools enabled per agent (for backwards compatibility)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    tool_slug TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',                    -- Tool-specific config
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    UNIQUE(agent_id, tool_slug)
);

CREATE INDEX idx_agent_tools_tenant ON agent_tools(tenant_id);
CREATE INDEX idx_agent_tools_agent ON agent_tools(agent_id);

-- =============================================================================
-- RAG / KNOWLEDGE BASE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- DOCUMENTS: Knowledge base documents
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Optional: assign to specific agent (NULL = available for linking)
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    
    -- Source tracking
    source_type TEXT DEFAULT 'manual',            -- 'manual', 'url', 'file', 'api'
    source_url TEXT,
    file_name TEXT,
    
    -- Visibility
    is_global BOOLEAN DEFAULT false,              -- Available to all agents
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_agent ON documents(agent_id);
CREATE INDEX idx_documents_global ON documents(is_global) WHERE is_global = true;

-- -----------------------------------------------------------------------------
-- DOCUMENT_CHUNKS: Embeddings for vector search
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    embedding vector(768),                        -- Gemini text-embedding-004
    
    -- Chunk position
    chunk_index INT DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_document_chunks_tenant ON document_chunks(tenant_id);
CREATE INDEX idx_document_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_embedding ON document_chunks 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- -----------------------------------------------------------------------------
-- AGENT_DOCUMENTS: Link agents to specific documents
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_documents (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    PRIMARY KEY (agent_id, document_id)
);

CREATE INDEX idx_agent_documents_tenant ON agent_documents(tenant_id);

-- =============================================================================
-- CHAT SYSTEM
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CHAT_SESSIONS: Conversation sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    
    -- User identification
    user_email TEXT,                              -- Logged-in user email
    user_phone TEXT,                              -- WhatsApp phone number
    
    -- Session info
    title TEXT,
    channel TEXT DEFAULT 'web',                   -- 'web', 'whatsapp', 'api'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_chat_sessions_tenant ON chat_sessions(tenant_id);
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_email);
CREATE INDEX idx_chat_sessions_phone ON chat_sessions(user_phone);
CREATE INDEX idx_chat_sessions_agent ON chat_sessions(agent_id);

-- -----------------------------------------------------------------------------
-- CHAT_MESSAGES: Individual messages in sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    
    role TEXT NOT NULL,                           -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    
    -- Tool usage tracking
    tool_calls JSONB,                             -- Tools invoked in this message
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_chat_messages_tenant ON chat_messages(tenant_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

-- =============================================================================
-- PROMETEO (SCHEDULED TASKS)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PROMETEO_TASKS: Scheduled/conditional AI tasks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prometeo_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    
    user_email TEXT NOT NULL,                     -- Owner of the task
    
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,                         -- What to ask the agent
    
    -- Schedule
    schedule TEXT NOT NULL,                       -- Cron expression
    timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires',
    
    -- State
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_prometeo_tasks_tenant ON prometeo_tasks(tenant_id);
CREATE INDEX idx_prometeo_tasks_user ON prometeo_tasks(user_email);
CREATE INDEX idx_prometeo_tasks_next_run ON prometeo_tasks(next_run_at) WHERE is_active = true;

-- -----------------------------------------------------------------------------
-- PROMETEO_EXECUTIONS: Task execution history
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prometeo_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES prometeo_tasks(id) ON DELETE CASCADE,
    
    status TEXT NOT NULL,                         -- 'success', 'error', 'timeout'
    result TEXT,                                  -- AI response or error message
    duration_ms INT,                              -- Execution time
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_prometeo_executions_tenant ON prometeo_executions(tenant_id);
CREATE INDEX idx_prometeo_executions_task ON prometeo_executions(task_id);

-- =============================================================================
-- BILLING & USAGE TRACKING
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USAGE_STATS: Token usage per user per month
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    user_email TEXT NOT NULL,
    year_month TEXT NOT NULL,                     -- 'YYYY-MM' format
    
    total_tokens INT DEFAULT 0,
    total_requests INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    UNIQUE(tenant_id, user_email, year_month)
);

CREATE INDEX idx_usage_stats_tenant ON usage_stats(tenant_id);
CREATE INDEX idx_usage_stats_month ON usage_stats(year_month);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PUSH_SUBSCRIPTIONS: Web push notification subscriptions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    user_email TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    keys JSONB NOT NULL,                          -- p256dh, auth
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    UNIQUE(endpoint)
);

CREATE INDEX idx_push_subscriptions_tenant ON push_subscriptions(tenant_id);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_email);

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS: In-app notification inbox
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    user_email TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    
    -- State
    is_read BOOLEAN DEFAULT false,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',                  -- link, action, etc
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_notifications_user ON notifications(user_email);
CREATE INDEX idx_notifications_unread ON notifications(user_email, is_read) WHERE is_read = false;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RAG: Match documents function with tenant isolation
-- -----------------------------------------------------------------------------
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
    SELECT rag_enabled, rag_strict 
    INTO v_rag_enabled, v_rag_strict 
    FROM agents 
    WHERE id = match_agent_id AND tenant_id = v_tenant_id;
    
    -- If RAG not enabled, return empty
    IF v_rag_enabled IS NOT TRUE THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        dc.id,
        dc.content,
        1 - (dc.embedding <=> query_embedding) AS similarity
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

-- -----------------------------------------------------------------------------
-- USAGE: Increment token usage
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_usage(
    p_user_email TEXT,
    p_tokens INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := current_tenant_id();
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant context not set';
    END IF;
    
    INSERT INTO usage_stats (tenant_id, user_email, year_month, total_tokens, total_requests, updated_at)
    VALUES (v_tenant_id, p_user_email, to_char(now(), 'YYYY-MM'), p_tokens, 1, now())
    ON CONFLICT (tenant_id, user_email, year_month)
    DO UPDATE SET 
        total_tokens = usage_stats.total_tokens + p_tokens,
        total_requests = usage_stats.total_requests + 1,
        updated_at = now();
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGERS: Auto-update updated_at timestamps
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'updated_at'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_update_%I_updated_at ON %I;
            CREATE TRIGGER trigger_update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        ', t, t, t, t);
    END LOOP;
END;
$$;

-- =============================================================================
-- COMMENTS (Documentation)
-- =============================================================================

COMMENT ON TABLE tenants IS 'Organizations using the platform. Each tenant is isolated via RLS.';
COMMENT ON TABLE users IS 'Users who can access the platform, linked to a tenant.';
COMMENT ON TABLE integrations IS 'Third-party service connections (Odoo, MercadoLibre, etc).';
COMMENT ON TABLE agents IS 'AI agent configurations per tenant.';
COMMENT ON TABLE documents IS 'Knowledge base documents for RAG.';
COMMENT ON TABLE document_chunks IS 'Vector embeddings for semantic search.';
COMMENT ON TABLE chat_sessions IS 'Conversation sessions (web or WhatsApp).';
COMMENT ON TABLE chat_messages IS 'Individual messages in conversations.';
COMMENT ON TABLE prometeo_tasks IS 'Scheduled AI tasks (like cron jobs).';
COMMENT ON TABLE usage_stats IS 'Token usage tracking for billing.';

COMMENT ON FUNCTION set_tenant_context IS 'Set the tenant_id for the current session. Must be called before any tenant-scoped queries.';
COMMENT ON FUNCTION current_tenant_id IS 'Get the current tenant_id from session context.';
COMMENT ON FUNCTION match_documents IS 'RAG semantic search with tenant isolation.';
COMMENT ON FUNCTION increment_usage IS 'Track token usage for billing.';
