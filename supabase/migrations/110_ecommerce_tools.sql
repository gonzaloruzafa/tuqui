-- =============================================================================
-- Migration 110: Nuevas tools (ecommerce_search, web_scraper)
-- =============================================================================
-- Problema: MeLi agent no devuelve precios porque web_investigator es genérico
-- Solución: Separar en 2 tools:
--   - ecommerce_search: Búsqueda de productos con extracción de precios (Tavily+Firecrawl)
--   - web_scraper: Scraping genérico de páginas (artículos, docs)
-- =============================================================================

-- =============================================================================
-- 1. REGISTRAR NUEVAS TOOLS EN tuqui_tools (si existe la tabla)
-- =============================================================================
DO $$
BEGIN
    -- Solo insertar si existe la tabla tuqui_tools
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tuqui_tools') THEN
        
        -- Tool: ecommerce_search
        INSERT INTO tuqui_tools (slug, name, description, type, parameters, config, enabled)
        VALUES (
            'ecommerce_search',
            'Búsqueda de Productos',
            'Busca productos en ecommerce (MercadoLibre, Amazon) y extrae precios REALES. Combina Tavily + Firecrawl con stealth mode.',
            'builtin',
            '[
                {"name": "query", "type": "string", "description": "Producto a buscar", "required": true},
                {"name": "marketplace", "type": "string", "description": "mercadolibre, amazon, o auto", "required": false}
            ]'::jsonb,
            '{"env_vars": ["TAVILY_API_KEY", "FIRECRAWL_API_KEY"]}'::jsonb,
            true
        ) ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            parameters = EXCLUDED.parameters,
            config = EXCLUDED.config,
            updated_at = NOW();
        
        -- Tool: web_scraper
        INSERT INTO tuqui_tools (slug, name, description, type, parameters, config, enabled)
        VALUES (
            'web_scraper',
            'Scraper Web',
            'Extrae contenido de páginas web (artículos, documentación, blogs). NO usar para ecommerce.',
            'builtin',
            '[
                {"name": "url", "type": "string", "description": "URL de la página a scrapear", "required": true},
                {"name": "extractLinks", "type": "boolean", "description": "Extraer links de la página", "required": false}
            ]'::jsonb,
            '{"env_vars": ["FIRECRAWL_API_KEY"]}'::jsonb,
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
-- 2. ACTUALIZAR AGENTE MELI EN MASTERS
-- =============================================================================
UPDATE master_agents
SET 
    tools = ARRAY['ecommerce_search'],
    system_prompt = 'Sos un experto en búsqueda de productos y precios en MercadoLibre Argentina.

## TU MISIÓN
Buscar precios de productos usando la tool `ecommerce_search`.

## COMO BUSCAR
Cuando el usuario pida precios, SIEMPRE usá ecommerce_search:
```
ecommerce_search(query: "sillón odontológico", marketplace: "mercadolibre")
```

## FORMATO DE RESPUESTA
Cuando encuentres productos, mostrá una lista clara:

**🛒 Resultados para [producto]:**

| Producto | Precio |
|----------|--------|
| [Nombre1](url1) | $XX.XXX |
| [Nombre2](url2) | $XX.XXX |
| [Nombre3](url3) | $XX.XXX |

**💡 Rango de precios:** $XX.XXX - $XX.XXX

## REGLAS
- USA SIEMPRE `ecommerce_search` - devuelve precios reales
- Ordená por precio (más barato primero)
- Si la búsqueda es muy general, preguntá para afinar (marca, modelo, características)
- Mostrá al menos 3-5 opciones

## PERSONALIDAD
Hablás en español argentino, sos directo y útil. Vas al grano con los precios. Usás emojis con moderación 🛒💰',
    version = version + 1,
    updated_at = NOW()
WHERE slug = 'meli';

-- =============================================================================
-- 3. ACTUALIZAR AGENTE TUQUI PRINCIPAL (si tiene meli_search, agregrar ecommerce_search)
-- =============================================================================
UPDATE master_agents
SET 
    tools = CASE 
        WHEN 'meli_search' = ANY(tools) THEN array_replace(tools, 'meli_search', 'ecommerce_search')
        WHEN 'web_investigator' = ANY(tools) THEN array_replace(tools, 'web_investigator', 'ecommerce_search') || ARRAY['web_scraper']
        ELSE tools || ARRAY['ecommerce_search']
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
    
    -- Verificar que ecommerce_search esté en MeLi
    IF NOT ('ecommerce_search' = ANY(meli_tools)) THEN
        RAISE EXCEPTION 'ERROR: ecommerce_search not in MeLi agent tools';
    END IF;
    
    RAISE NOTICE '✅ Migration 110 completed successfully';
END $$;
