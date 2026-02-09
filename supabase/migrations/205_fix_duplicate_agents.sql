-- Fix duplicate agents per tenant (same slug)
-- The sync function could create duplicates if agents existed without master_agent_id

-- Remove duplicates keeping the oldest record
DELETE FROM agents a
USING agents b
WHERE a.tenant_id = b.tenant_id
  AND a.slug = b.slug
  AND a.created_at > b.created_at;

-- Prevent future duplicates
ALTER TABLE agents ADD CONSTRAINT agents_tenant_slug_unique UNIQUE (tenant_id, slug);
