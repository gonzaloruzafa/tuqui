-- =============================================================================
-- TUQUI AGENTS - SEED DATA
-- =============================================================================
-- Migration: 102_seed_data.sql
-- Description: Initial data for Adhoc tenant and Tuqui agent
-- Created: 2026-01-02
-- =============================================================================

-- =============================================================================
-- ADHOC TENANT
-- =============================================================================

INSERT INTO tenants (
    id,
    slug,
    name,
    company_name,
    industry,
    description,
    tone_of_voice,
    website,
    twilio_phone,
    is_active
) VALUES (
    'de7ef34a-12bd-4fe9-9d02-3d876a9393c2',  -- Keep same ID for continuity
    'adhoc',
    'Cliente Adhoc',
    'Adhoc',
    'Tecnología / Software',
    'Empresa de desarrollo de software especializada en ERP Odoo y soluciones empresariales',
    'profesional pero cercano, en español argentino',
    'https://adhoc.ar',
    '+14155238886',  -- Twilio sandbox number
    true
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    company_name = EXCLUDED.company_name,
    industry = EXCLUDED.industry,
    description = EXCLUDED.description;

-- =============================================================================
-- TUQUI UNIFIED AGENT
-- =============================================================================

INSERT INTO agents (
    id,
    tenant_id,
    slug,
    name,
    description,
    icon,
    color,
    is_active,
    rag_enabled,
    rag_strict,
    tools,
    system_prompt,
    welcome_message,
    placeholder_text
) VALUES (
    gen_random_uuid(),
    'de7ef34a-12bd-4fe9-9d02-3d876a9393c2',
    'tuqui',
    'Tuqui',
    'Tu asistente de IA empresarial',
    'Sparkles',
    'adhoc-violet',
    true,
    true,
    false,
    ARRAY['odoo_intelligent_query', 'meli_search', 'web_search'],
    'Sos Tuqui, el asistente de IA empresarial más completo.

## 🎯 TU PERSONALIDAD
- Hablás en español argentino, tuteando
- Sos conciso pero útil
- Usás emojis con moderación
- Si no sabés algo, lo decís honestamente

## 🛠️ TUS CAPACIDADES

### 1. DATOS DEL ERP (Odoo)
Cuando pregunten sobre ventas, compras, facturas, stock, clientes, proveedores:
- Usá la tool `odoo_intelligent_query`
- Podés hacer agregaciones, rankings, comparaciones
- Entendés períodos: "este mes", "Q4 2025", "año pasado"

### 2. MERCADOLIBRE
Cuando pregunten precios de productos o comparaciones de mercado:
- Usá la tool `meli_search`
- Buscá en Argentina (MLA)

### 3. DOCUMENTOS INTERNOS (RAG)
Cuando pregunten sobre procedimientos, políticas, manuales de la empresa:
- El contexto relevante se inyecta automáticamente
- Basá tus respuestas en esos documentos

### 4. BÚSQUEDA WEB
Cuando necesites información actualizada (cotizaciones, noticias, regulaciones):
- Usá la tool `web_search`

### 5. CONSULTAS LEGALES Y CONTABLES
Podés orientar sobre:
- Leyes laborales (Ley 20.744)
- Sociedades (SAS, SRL, SA)
- Impuestos (IVA, Ganancias, Monotributo)
- Defensa del consumidor

⚠️ IMPORTANTE: Siempre aclará que es orientación general y recomendá consultar profesionales.

## 📝 FORMATO DE RESPUESTAS
- Usá Markdown para estructurar (negritas, listas, tablas)
- Montos en formato argentino: $ 1.234.567,89
- Fechas: DD/MM/YYYY
- Emojis para tendencias: 📈 📉

## 🔄 CONTEXTO CONVERSACIONAL
- Recordá lo que se habló antes en la conversación
- Si el usuario dice "qué más?" o "el segundo?", usá el contexto previo
- No pidas aclaraciones innecesarias si la info está en el historial',
    '¿En qué puedo ayudarte?',
    'Preguntale lo que quieras a Tuqui...'
) ON CONFLICT (tenant_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    system_prompt = EXCLUDED.system_prompt,
    tools = EXCLUDED.tools;

-- =============================================================================
-- ADMIN USER
-- =============================================================================

INSERT INTO users (
    tenant_id,
    email,
    name,
    is_admin
) VALUES (
    'de7ef34a-12bd-4fe9-9d02-3d876a9393c2',
    'gonzalo.ruza@adhoc.com.ar',
    'Gonzalo Ruza',
    true
) ON CONFLICT (tenant_id, email) DO UPDATE SET
    is_admin = true;

-- =============================================================================
-- ODOO INTEGRATION (Template - update credentials after migration)
-- =============================================================================

INSERT INTO integrations (
    tenant_id,
    type,
    config,
    is_active
) VALUES (
    'de7ef34a-12bd-4fe9-9d02-3d876a9393c2',
    'odoo',
    '{
        "odoo_url": "https://train-cedent-09-12-2.adhoc.ar",
        "odoo_db": "odoo",
        "odoo_user": "fdelpazo",
        "odoo_password": "UPDATE_THIS_VALUE"
    }'::jsonb,
    true
) ON CONFLICT (tenant_id, type) DO NOTHING;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Check that data was inserted
DO $$
DECLARE
    tenant_count INT;
    agent_count INT;
    user_count INT;
BEGIN
    SELECT COUNT(*) INTO tenant_count FROM tenants;
    SELECT COUNT(*) INTO agent_count FROM agents;
    SELECT COUNT(*) INTO user_count FROM users;
    
    RAISE NOTICE 'Seed complete: % tenants, % agents, % users', 
        tenant_count, agent_count, user_count;
END $$;
