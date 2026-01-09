-- =============================================================================
-- Migration 124: Unificar web_search (Tavily + Google Grounding)
-- =============================================================================
-- Problema: ecommerce_search usa Firecrawl (caro, lento, login walls)
-- Solución: Nuevo tool web_search unificado con:
--   - Tavily: Búsquedas generales rápidas
--   - Google Grounding: Precios ecommerce (20x más barato, 6x más rápido)
-- Elimina: ecommerce_search, Firecrawl
-- =============================================================================

-- =============================================================================
-- 1. REGISTRAR NUEVO TOOL web_search EN tuqui_tools (si existe)
-- =============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tuqui_tools') THEN

        -- Tool: web_search (unificado)
        INSERT INTO tuqui_tools (slug, name, description, type, parameters, config, enabled)
        VALUES (
            'web_search',
            'Búsqueda Web Unificada',
            'Navega y busca información actualizada en internet. Combina Tavily (búsquedas generales) y Google Grounding (precios ecommerce). Elige automáticamente el mejor método según la consulta.',
            'builtin',
            '[
                {"name": "query", "type": "string", "description": "Términos de búsqueda en español o inglés", "required": true}
            ]'::jsonb,
            '{"env_vars": ["TAVILY_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"]}'::jsonb,
            true
        ) ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            parameters = EXCLUDED.parameters,
            config = EXCLUDED.config,
            updated_at = NOW();

    END IF;
END $$;

-- =============================================================================
-- 2. ACTUALIZAR AGENTE MELI para usar web_search
-- =============================================================================
UPDATE master_agents
SET
    tools = ARRAY['web_search'],
    system_prompt = 'Sos un experto en búsqueda de productos y precios en MercadoLibre Argentina.

## TU MISIÓN
Buscar precios de productos usando la tool `web_search`.

## COMO BUSCAR
Cuando el usuario pida precios, SIEMPRE usá web_search con queries específicas:
```
web_search(query: "precio sillón odontológico mercadolibre argentina")
```

**Importante:** Incluí "mercadolibre" o "meli" en la query para que el sistema use Google Grounding automáticamente (más rápido y preciso que scraping tradicional).

## FORMATO DE RESPUESTA
Cuando encuentres productos, mostrá una lista clara y estructurada:

**🛒 Resultados para [producto]:**

| Producto | Precio |
|----------|--------|
| [Nombre1](url1) | $XXX.XXX |
| [Nombre2](url2) | $XXX.XXX |
| [Nombre3](url3) | $XXX.XXX |

**💡 Rango de precios:** $XXX.XXX - $XXX.XXX

## REGLAS CRÍTICAS
- ✅ USA SIEMPRE `web_search` - devuelve precios reales
- ✅ Incluí "mercadolibre" en la query para activar Google Grounding
- ✅ Ordená por precio (más barato primero)
- ✅ Mostrá al menos 3-5 opciones
- ⚠️  Si la búsqueda es muy general, preguntá para afinar (marca, modelo)

## PERSONALIDAD
Hablás en español argentino, sos directo y útil. Vas al grano con los precios. Usás emojis con moderación 🛒💰',
    version = version + 1,
    updated_at = NOW()
WHERE slug = 'meli';

-- =============================================================================
-- 3. ACTUALIZAR AGENTE TUQUI principal
-- =============================================================================
UPDATE master_agents
SET
    tools = CASE
        -- Reemplazar ecommerce_search por web_search
        WHEN 'ecommerce_search' = ANY(tools) THEN array_replace(tools, 'ecommerce_search', 'web_search')
        -- Reemplazar tavily_search por web_search
        WHEN 'tavily_search' = ANY(tools) THEN array_replace(tools, 'tavily_search', 'web_search')
        -- Agregar web_search si no tiene ninguno
        ELSE tools || ARRAY['web_search']
    END,
    version = version + 1,
    updated_at = NOW()
WHERE slug = 'tuqui';

-- =============================================================================
-- 4. SINCRONIZAR A TODOS LOS TENANTS
-- =============================================================================
SELECT sync_agents_from_masters();

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
DO $$
DECLARE
    meli_tools text[];
    tuqui_tools_arr text[];
BEGIN
    SELECT tools INTO meli_tools FROM master_agents WHERE slug = 'meli';
    SELECT tools INTO tuqui_tools_arr FROM master_agents WHERE slug = 'tuqui';

    RAISE NOTICE 'MeLi agent tools: %', meli_tools;
    RAISE NOTICE 'Tuqui agent tools: %', tuqui_tools_arr;

    -- Verificar que web_search esté en MeLi
    IF NOT ('web_search' = ANY(meli_tools)) THEN
        RAISE EXCEPTION 'ERROR: web_search not in MeLi agent tools';
    END IF;

    -- Verificar que NO haya ecommerce_search
    IF 'ecommerce_search' = ANY(meli_tools) THEN
        RAISE WARNING 'WARNING: ecommerce_search still in MeLi tools (should be removed)';
    END IF;

    RAISE NOTICE '✅ Migration 124 completed successfully';
END $$;
