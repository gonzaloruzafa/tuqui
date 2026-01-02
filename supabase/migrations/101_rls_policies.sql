-- =============================================================================
-- TUQUI AGENTS - ROW LEVEL SECURITY POLICIES
-- =============================================================================
-- Migration: 101_rls_policies.sql
-- Description: RLS policies for tenant isolation
-- Created: 2026-01-02
-- 
-- IMPORTANT: All policies use current_tenant_id() which reads from 
-- the session variable 'app.tenant_id' set via set_tenant_context()
-- =============================================================================

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE prometeo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prometeo_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TENANTS TABLE
-- Special case: Can only see your own tenant
-- =============================================================================

-- Service role bypasses RLS, so this is for anon/authenticated
CREATE POLICY "tenants_select_own" ON tenants
    FOR SELECT
    USING (id = current_tenant_id());

CREATE POLICY "tenants_update_own" ON tenants
    FOR UPDATE
    USING (id = current_tenant_id())
    WITH CHECK (id = current_tenant_id());

-- No insert/delete via RLS (admin only via service role)

-- =============================================================================
-- USERS TABLE
-- =============================================================================

CREATE POLICY "users_select_tenant" ON users
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "users_insert_tenant" ON users
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "users_update_tenant" ON users
    FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "users_delete_tenant" ON users
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- INTEGRATIONS TABLE
-- =============================================================================

CREATE POLICY "integrations_select_tenant" ON integrations
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "integrations_insert_tenant" ON integrations
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "integrations_update_tenant" ON integrations
    FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "integrations_delete_tenant" ON integrations
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- AGENTS TABLE
-- =============================================================================

CREATE POLICY "agents_select_tenant" ON agents
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "agents_insert_tenant" ON agents
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "agents_update_tenant" ON agents
    FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "agents_delete_tenant" ON agents
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- AGENT_TOOLS TABLE
-- =============================================================================

CREATE POLICY "agent_tools_select_tenant" ON agent_tools
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "agent_tools_insert_tenant" ON agent_tools
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "agent_tools_update_tenant" ON agent_tools
    FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "agent_tools_delete_tenant" ON agent_tools
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- DOCUMENTS TABLE
-- =============================================================================

CREATE POLICY "documents_select_tenant" ON documents
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "documents_insert_tenant" ON documents
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "documents_update_tenant" ON documents
    FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "documents_delete_tenant" ON documents
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- DOCUMENT_CHUNKS TABLE
-- =============================================================================

CREATE POLICY "document_chunks_select_tenant" ON document_chunks
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "document_chunks_insert_tenant" ON document_chunks
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "document_chunks_update_tenant" ON document_chunks
    FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "document_chunks_delete_tenant" ON document_chunks
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- AGENT_DOCUMENTS TABLE
-- =============================================================================

CREATE POLICY "agent_documents_select_tenant" ON agent_documents
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "agent_documents_insert_tenant" ON agent_documents
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "agent_documents_delete_tenant" ON agent_documents
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- CHAT_SESSIONS TABLE
-- =============================================================================

CREATE POLICY "chat_sessions_select_tenant" ON chat_sessions
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "chat_sessions_insert_tenant" ON chat_sessions
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "chat_sessions_update_tenant" ON chat_sessions
    FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "chat_sessions_delete_tenant" ON chat_sessions
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- CHAT_MESSAGES TABLE
-- =============================================================================

CREATE POLICY "chat_messages_select_tenant" ON chat_messages
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "chat_messages_insert_tenant" ON chat_messages
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "chat_messages_delete_tenant" ON chat_messages
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- PROMETEO_TASKS TABLE
-- =============================================================================

CREATE POLICY "prometeo_tasks_select_tenant" ON prometeo_tasks
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "prometeo_tasks_insert_tenant" ON prometeo_tasks
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "prometeo_tasks_update_tenant" ON prometeo_tasks
    FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "prometeo_tasks_delete_tenant" ON prometeo_tasks
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- PROMETEO_EXECUTIONS TABLE
-- =============================================================================

CREATE POLICY "prometeo_executions_select_tenant" ON prometeo_executions
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "prometeo_executions_insert_tenant" ON prometeo_executions
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

-- =============================================================================
-- USAGE_STATS TABLE
-- =============================================================================

CREATE POLICY "usage_stats_select_tenant" ON usage_stats
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "usage_stats_insert_tenant" ON usage_stats
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "usage_stats_update_tenant" ON usage_stats
    FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- =============================================================================
-- PUSH_SUBSCRIPTIONS TABLE
-- =============================================================================

CREATE POLICY "push_subscriptions_select_tenant" ON push_subscriptions
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "push_subscriptions_insert_tenant" ON push_subscriptions
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "push_subscriptions_delete_tenant" ON push_subscriptions
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- NOTIFICATIONS TABLE
-- =============================================================================

CREATE POLICY "notifications_select_tenant" ON notifications
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "notifications_insert_tenant" ON notifications
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "notifications_update_tenant" ON notifications
    FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "notifications_delete_tenant" ON notifications
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- SPECIAL POLICIES
-- =============================================================================

-- Allow looking up tenant by slug (for login flow before tenant is set)
CREATE POLICY "tenants_select_by_slug" ON tenants
    FOR SELECT
    USING (true);  -- Anyone can look up tenant by slug

-- Allow looking up user by email (for login flow)
CREATE POLICY "users_select_by_email" ON users
    FOR SELECT
    USING (true);  -- Login needs to find user by email

-- Allow looking up tenant by twilio_phone (for WhatsApp webhook)
-- This is already covered by tenants_select_by_slug policy

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================
-- Run this to verify all tables have RLS enabled:
/*
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
*/
