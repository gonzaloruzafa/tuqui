-- Migration 203: Memory table for user-scoped notes
--
-- Lets users save notes about entities (customers, products, suppliers)
-- that Tuqui can recall in future conversations.
-- Memory is per-user: what Juan saves, only Juan sees.
--
-- Future: add scope column + save_company_memory skill for shared notes.

CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  
  -- Content
  entity_name TEXT,
  entity_type TEXT DEFAULT 'general',
  content TEXT NOT NULL,
  
  -- Metadata
  use_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_memories_user ON memories(created_by);
CREATE INDEX idx_memories_entity ON memories(tenant_id, entity_name);
CREATE INDEX idx_memories_tenant ON memories(tenant_id);

-- RLS
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memories"
  ON memories FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert own memories"
  ON memories FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own memories"
  ON memories FOR DELETE
  USING (created_by = auth.uid());

-- Service role bypass for API routes
CREATE POLICY "Service role full access to memories"
  ON memories FOR ALL
  USING (auth.role() = 'service_role');
