-- =============================================================================
-- COMPANY CONTEXT - Structured multi-source company knowledge
-- =============================================================================
-- Migration: 200_company_context.sql
-- Description: Replace free-text company_context with structured data
-- Created: 2026-02-06
-- =============================================================================

CREATE TABLE IF NOT EXISTS company_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- ===== DATOS MANUALES (UI) =====
  basics JSONB DEFAULT '{}'::jsonb,
  -- { industry, description, location }
  
  key_customers JSONB DEFAULT '[]'::jsonb,
  -- [{ name, notes }]
  
  key_products JSONB DEFAULT '[]'::jsonb,
  -- [{ name, notes }]
  
  business_rules JSONB DEFAULT '[]'::jsonb,
  -- ["Margen mínimo 30%", "No vender sin anticipo a nuevos"]
  
  tone_of_voice TEXT,
  
  -- ===== WEB SCRAPING =====
  web_summary TEXT,
  web_scanned_at TIMESTAMPTZ,
  source_urls JSONB DEFAULT '[]'::jsonb,
  
  -- ===== DOCS VINCULADOS (referencia a tabla documents existente) =====
  linked_documents UUID[] DEFAULT '{}',
  
  -- ===== METADATA =====
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  
  UNIQUE(tenant_id)
);

CREATE INDEX idx_company_contexts_tenant ON company_contexts(tenant_id);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_company_context_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_contexts_updated
  BEFORE UPDATE ON company_contexts
  FOR EACH ROW
  EXECUTE FUNCTION update_company_context_timestamp();
