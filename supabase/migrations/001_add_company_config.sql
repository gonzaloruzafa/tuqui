-- MIGRATION: Add company configuration fields to tenants table
-- Run this in the MASTER Supabase project (uhmrsalgmyufufsxixpu)
-- Date: 2024-12-30

-- Add company configuration fields
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_cuit TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_industry TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_description TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_location TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_employees_count TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_products_services TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_target_customers TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_special_instructions TEXT;

-- Generated context (auto-regenerated when any field changes)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_context TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_context_updated_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN tenants.company_name IS 'Nombre de la empresa del cliente';
COMMENT ON COLUMN tenants.company_cuit IS 'CUIT de la empresa';
COMMENT ON COLUMN tenants.company_industry IS 'Industria/rubro de la empresa';
COMMENT ON COLUMN tenants.company_description IS 'Descripción general de la empresa';
COMMENT ON COLUMN tenants.company_location IS 'Ubicación principal (ciudad, provincia)';
COMMENT ON COLUMN tenants.company_employees_count IS 'Cantidad aproximada de empleados';
COMMENT ON COLUMN tenants.company_products_services IS 'Productos o servicios que ofrece';
COMMENT ON COLUMN tenants.company_target_customers IS 'Clientes objetivo (B2B, B2C, sectores)';
COMMENT ON COLUMN tenants.company_special_instructions IS 'Instrucciones especiales para los agentes';
COMMENT ON COLUMN tenants.company_context IS 'Contexto generado automáticamente por IA para inyectar en agentes';
COMMENT ON COLUMN tenants.company_context_updated_at IS 'Última actualización del contexto generado';
