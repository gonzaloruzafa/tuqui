-- Migration 127: Fix odoo agent tools field
-- 
-- Problem: Migration 126 updated the system_prompt but forgot to update the tools field.
-- The agent still has tools = ['odoo_intelligent_query'] which doesn't exist anymore.
-- When the model tries to call odoo_intelligent_query, it gets "Tool not found" error.
--
-- Solution: Update the tools field to use the new 'odoo' tool slug which loads
-- all 24 specific skills (get_sales_total, get_invoices_by_customer, etc.)

UPDATE master_agents
SET 
    tools = ARRAY['odoo'],
    updated_at = NOW()
WHERE slug = 'odoo';

-- Also update tuqui agent if it references odoo_intelligent_query
UPDATE agents
SET 
    tools = array_replace(tools, 'odoo_intelligent_query', 'odoo'),
    updated_at = NOW()
WHERE 'odoo_intelligent_query' = ANY(tools);

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 127: Fixed odoo agent tools field from odoo_intelligent_query to odoo';
END $$;
