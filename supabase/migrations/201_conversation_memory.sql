-- supabase/migrations/201_conversation_memory.sql
-- Table to store conversational insights extracted from chats

CREATE TABLE IF NOT EXISTS conversation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  entity_type TEXT,      -- 'customer', 'product', 'supplier', 'general'
  entity_name TEXT,      -- 'MegaCorp', 'iPhone 15', etc.
  insight TEXT NOT NULL, -- 'Siempre paga tarde', 'Prefiere entregas por la mañana'

  source_session_id UUID,
  confidence FLOAT DEFAULT 0.8,
  use_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenants can only see their own insights"
  ON conversation_insights
  FOR ALL
  USING (tenant_id = auth.uid() OR tenant_id::text = current_setting('app.tenant_id', true));

-- Indexes for performance
CREATE INDEX idx_insights_tenant ON conversation_insights(tenant_id);
CREATE INDEX idx_insights_entity ON conversation_insights(entity_name);
