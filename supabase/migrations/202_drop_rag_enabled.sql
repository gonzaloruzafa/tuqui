-- Migration: Drop deprecated rag_enabled column
-- 
-- The rag_enabled flag has been replaced by tools.includes('knowledge_base').
-- Migration 130 already migrated all agents with rag_enabled=true to have
-- 'knowledge_base' in their tools[] array.
-- 
-- This migration removes the now-unused column from both tables.

ALTER TABLE master_agents DROP COLUMN IF EXISTS rag_enabled;
ALTER TABLE agents DROP COLUMN IF EXISTS rag_enabled;
