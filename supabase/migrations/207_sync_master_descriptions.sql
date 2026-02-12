-- =============================================================================
-- SYNC MASTER AGENT DESCRIPTIONS
-- =============================================================================
-- Migration: 207_sync_master_descriptions.sql
-- Problem: Migration 201 updated descriptions in `agents` table (tenant instances)
--          but NOT in `master_agents` (templates). New tenants get old vague
--          descriptions, causing the orchestrator to misroute queries.
-- Fix: Update master_agents descriptions + bump version to trigger sync.
-- =============================================================================

-- Tuqui: identity + general questions
UPDATE master_agents SET
    description = 'Asistente general de IA. Responde preguntas sobre la empresa (quiénes somos, qué hacemos, identidad), conversación general, y cualquier consulta que no sea datos numéricos del ERP, impuestos, legal o precios de MercadoLibre.',
    version = version + 1,
    updated_at = now()
WHERE slug = 'tuqui';

-- Odoo: ERP data queries (ventas, facturas, stock, etc.)
UPDATE master_agents SET
    description = 'Consultas de DATOS numéricos del ERP Odoo: ventas, facturas, stock, deudas, cobranzas, clientes, productos, contabilidad operativa. NO para preguntas de identidad de la empresa ni consultas generales.',
    version = version + 1,
    updated_at = now()
WHERE slug = 'odoo';

-- Contador: theoretical tax/accounting (NOT operational data)
UPDATE master_agents SET
    description = 'Experto en impuestos TEÓRICOS, normativa tributaria y contabilidad conceptual argentina. USAR CUANDO: "cómo funciona el monotributo", "qué alícuota de IVA", "cómo calcular ganancias". NO para consultar datos reales de ventas/facturas del ERP.',
    version = version + 1,
    updated_at = now()
WHERE slug = 'contador';

-- Abogado: legal orientation
UPDATE master_agents SET
    description = 'Orientación legal sobre leyes argentinas: laboral, societario, contratos, regulaciones. USAR CUANDO: "qué dice la ley sobre vacaciones", "cómo armar un contrato", "qué necesito para una SAS". NO para datos del ERP ni impuestos.',
    version = version + 1,
    updated_at = now()
WHERE slug = 'abogado';

-- MeLi: product search & pricing
UPDATE master_agents SET
    description = 'Buscador de precios y productos en MercadoLibre Argentina. USAR CUANDO: "cuánto sale un iPhone", "precio de notebook", "buscame X en MeLi". NO para datos internos de la empresa.',
    version = version + 1,
    updated_at = now()
WHERE slug = 'meli';

-- Also update existing tenant agents that still have old descriptions
-- (for tenants created after migration 201 ran, which got old master descriptions)
UPDATE agents SET
    description = ma.description
FROM master_agents ma
WHERE agents.master_agent_id = ma.id
  AND agents.slug IN ('tuqui', 'odoo', 'contador', 'abogado', 'meli')
  AND (agents.description IS DISTINCT FROM ma.description);
