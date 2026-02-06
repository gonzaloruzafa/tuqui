-- supabase/migrations/200_company_context.sql
-- Table for structured company context

CREATE TABLE IF NOT EXISTS company_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Structured knowledge
  key_products JSONB DEFAULT '[]',    -- [{ name: string, notes: string }]
  key_customers JSONB DEFAULT '[]',   -- [{ name: string, notes: string }]
  key_suppliers JSONB DEFAULT '[]',   -- [{ name: string, notes: string }]
  business_rules JSONB DEFAULT '[]',  -- [string]

  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE company_contexts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenants can only see their own company context"
  ON company_contexts
  FOR ALL
  USING (tenant_id = auth.uid() OR tenant_id::text = current_setting('app.tenant_id', true));
