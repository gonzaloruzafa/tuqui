-- =============================================================================
-- AGENT DESCRIPTIONS - Enrich for better orchestrator routing
-- =============================================================================
-- Migration: 201_agent_descriptions.sql
-- Description: Update agent descriptions so the LLM orchestrator routes correctly
-- Created: 2026-02-07
-- =============================================================================

-- Tuqui: explicitly claim identity/general questions
UPDATE agents SET description = 'Asistente general de IA. Responde preguntas sobre la empresa (quiénes somos, qué hacemos, identidad), conversación general, y cualquier consulta que no sea datos numéricos del ERP, impuestos, legal o precios de MercadoLibre.'
WHERE slug = 'tuqui';

-- Odoo: clarify it's for ERP DATA only
UPDATE agents SET description = 'Consultas de DATOS numéricos del ERP Odoo: ventas, facturas, stock, deudas, cobranzas, clientes, productos, contabilidad operativa. NO para preguntas de identidad de la empresa ni consultas generales.'
WHERE slug = 'odoo';
