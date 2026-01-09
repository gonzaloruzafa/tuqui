const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

console.log('🔧 Connecting to Supabase...');
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const migrationPath = path.join(__dirname, '../supabase/migrations/124_unified_web_search.sql');

console.log('📝 Applying migration 124: Unified Web Search...');

(async () => {
  try {
    // Actualizar agente MeLi para usar web_search
    const newPrompt = `Sos un experto en búsqueda de productos y precios en MercadoLibre Argentina.

## TU MISIÓN
Buscar precios de productos usando la tool \`web_search\`.

## COMO BUSCAR
Cuando el usuario pida precios, SIEMPRE usá web_search con queries específicas:
\`\`\`
web_search(query: "precio sillón odontológico mercadolibre argentina")
\`\`\`

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
- ✅ USA SIEMPRE \`web_search\` - devuelve precios reales
- ✅ Incluí "mercadolibre" en la query para activar Google Grounding
- ✅ Ordená por precio (más barato primero)
- ✅ Mostrá al menos 3-5 opciones
- ⚠️  Si la búsqueda es muy general, preguntá para afinar (marca, modelo)

## PERSONALIDAD
Hablás en español argentino, sos directo y útil. Vas al grano con los precios. Usás emojis con moderación 🛒💰`;

    const { data: meliData, error: meliError } = await supabase
      .from('master_agents')
      .update({
        system_prompt: newPrompt,
        tools: ['web_search']
      })
      .eq('slug', 'meli')
      .select();

    if (meliError) {
      console.error('❌ Error updating MeLi agent:', meliError);
      process.exit(1);
    }

    console.log('✅ MeLi agent updated!');
    console.log(`📊 Updated ${meliData && meliData.length || 0} record(s)`);

    // Actualizar agente Tuqui para reemplazar ecommerce_search/tavily_search con web_search
    const { data: tuquiData, error: tuquiError } = await supabase
      .from('master_agents')
      .select('*')
      .eq('slug', 'tuqui')
      .single();

    if (tuquiError) {
      console.error('❌ Error fetching Tuqui agent:', tuquiError);
      process.exit(1);
    }

    if (tuquiData) {
      let tools = tuquiData.tools || [];

      // Reemplazar tools legacy
      tools = tools.filter(t => t !== 'ecommerce_search' && t !== 'tavily_search');
      if (!tools.includes('web_search')) {
        tools.push('web_search');
      }

      const { error: updateError } = await supabase
        .from('master_agents')
        .update({ tools })
        .eq('slug', 'tuqui');

      if (updateError) {
        console.error('❌ Error updating Tuqui agent:', updateError);
      } else {
        console.log('✅ Tuqui agent updated!');
      }
    }

    console.log('✅ Migration 124 applied successfully!');

  } catch (err) {
    console.error('❌ Exception:', err.message);
    process.exit(1);
  }
})();
