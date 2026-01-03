-- =============================================================================
-- Migration 108: Add keywords field + Fix MeLi prompt for URLs
-- =============================================================================

-- 1. Add keywords column to master_agents if not exists
ALTER TABLE master_agents ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

-- 2. Add keywords column to agents if not exists  
ALTER TABLE agents ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

-- 3. Update MeLi agent with keywords and fixed prompt (no URL hallucination)
UPDATE master_agents SET 
    keywords = ARRAY['precio', 'precios', 'mercadolibre', 'mercado libre', 'meli', 
                     'cuanto cuesta', 'cuanto sale', 'cuánto cuesta', 'cuánto sale',
                     'comparar precios', 'buscar producto', 'donde comprar', 'dónde comprar',
                     'mas barato', 'más barato', 'ofertas'],
    system_prompt = 'Buscás productos y precios en MercadoLibre Argentina.

## ⚠️ REGLA CRÍTICA: NUNCA INVENTES URLs
- SIEMPRE usá las URLs EXACTAS del campo "sources[].url" que devuelve web_search
- Copiá la URL tal cual aparece en el resultado, no la modifiques
- Si web_search devuelve {"sources": [{"url": "https://articulo.mercadolibre.com.ar/MLA-123", "title": "Producto X"}]}
  → Usá ESA URL exacta: [Ver en MeLi](https://articulo.mercadolibre.com.ar/MLA-123)
- Si no hay URL en el resultado, simplemente NO pongas link

## BÚSQUEDAS
- Agregá "site:mercadolibre.com.ar" a tus búsquedas con web_search
- Si no hay precios claros en los resultados, usá web_investigator en las URLs para extraer detalles

## FORMATO DE RESPUESTA
**🛒 Resultados para [producto]:**

1. **[Título exacto del resultado]** - $XX.XXX
   - [Ver en MeLi](URL_EXACTA_DEL_SOURCE)

2. **[Otro producto]** - $XX.XXX
   - [Ver en MeLi](URL_EXACTA)

## REGLAS
- Máximo 5 resultados, ordenados por precio (más barato primero)
- Si la búsqueda es muy general, preguntá para afinar (marca, modelo, tamaño)
- Mostrá precios en formato argentino: $XXX.XXX

## PERSONALIDAD
Español argentino, directo y útil. Emojis con moderación 🛒',
    version = version + 1,
    updated_at = now()
WHERE slug = 'meli';

-- 4. Update Odoo agent with keywords and rename to "Tuqui Odoo"
UPDATE master_agents SET 
    name = 'Tuqui Odoo',
    keywords = ARRAY['ventas', 'vendimos', 'factura', 'facturas', 'facturamos',
                     'stock', 'inventario', 'clientes', 'proveedores',
                     'pedidos', 'compras', 'compramos', 'deuda', 'deudas',
                     'odoo', 'erp', 'sistema', 'cuenta corriente', 'saldo',
                     'trimestre', 'mes pasado', 'este año', 'año pasado'],
    version = version + 1,
    updated_at = now()
WHERE slug = 'odoo';

-- 5. Update Tuqui base agent with keywords (general)
UPDATE master_agents SET 
    keywords = ARRAY['hola', 'ayuda', 'como estas', 'gracias', 'chau'],
    version = version + 1,
    updated_at = now()
WHERE slug = 'tuqui';

-- 6. Sync to all tenants
SELECT sync_agents_from_masters();

-- 7. Update sync function to include keywords
CREATE OR REPLACE FUNCTION sync_agents_from_masters()
RETURNS void AS $$
DECLARE
    master_rec master_agents%ROWTYPE;
    tenant_rec RECORD;
BEGIN
    -- For each published master agent
    FOR master_rec IN 
        SELECT * FROM master_agents WHERE is_published = true
    LOOP
        -- For each tenant
        FOR tenant_rec IN 
            SELECT id FROM tenants
        LOOP
            -- Insert or update agent for this tenant
            INSERT INTO agents (
                tenant_id, master_agent_id, slug, name, description,
                icon, color, system_prompt, welcome_message, placeholder_text,
                tools, rag_enabled, is_active, master_version_synced, keywords
            )
            VALUES (
                tenant_rec.id, master_rec.id, master_rec.slug, master_rec.name, master_rec.description,
                master_rec.icon, master_rec.color, master_rec.system_prompt, master_rec.welcome_message, master_rec.placeholder_text,
                master_rec.tools, master_rec.rag_enabled, true, master_rec.version, master_rec.keywords
            )
            ON CONFLICT (tenant_id, slug) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                icon = EXCLUDED.icon,
                color = EXCLUDED.color,
                system_prompt = EXCLUDED.system_prompt,
                welcome_message = EXCLUDED.welcome_message,
                placeholder_text = EXCLUDED.placeholder_text,
                tools = EXCLUDED.tools,
                rag_enabled = EXCLUDED.rag_enabled,
                master_version_synced = EXCLUDED.master_version_synced,
                keywords = EXCLUDED.keywords,
                updated_at = now();
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run sync again with updated function
SELECT sync_agents_from_masters();
