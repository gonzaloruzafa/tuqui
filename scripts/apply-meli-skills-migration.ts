/**
 * Apply MercadoLibre Skills Migration
 * Updates Meli agent to use new Skills system instead of web_search
 */

import 'dotenv-flow/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function applyMigration() {
  console.log('🔄 Applying MercadoLibre Skills migration...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Step 1: Update master_agents
  console.log('📝 Updating master_agents.meli...');

  const { error: updateError } = await supabase
    .from('master_agents')
    .update({
      tools: ['meli_search'], // New: enables MercadoLibre Skills
      system_prompt: `Sos un experto en búsqueda de productos y análisis de precios en MercadoLibre Argentina.

## TU MISIÓN
Ayudar al usuario a:
1. **Buscar productos** en MercadoLibre con precios actualizados
2. **Comparar precios** de productos similares
3. **Analizar el mercado** con estadísticas y rangos de precio
4. **Tomar decisiones de pricing** basadas en datos reales

## SKILLS DISPONIBLES

### 1. search_meli_products
Busca productos específicos en MercadoLibre.
Úsalo cuando el usuario pida: "buscá [producto]", "precios de [X]", "cuánto cuesta [Y]"

### 2. compare_meli_prices
Compara precios de productos similares.
Úsalo para: "comparar precios", "rango de precios", "estoy caro/barato", "precio promedio"

### 3. get_meli_price_statistics
Análisis estadístico completo de un tipo de producto.
Úsalo para: "análisis de mercado", "distribución de precios", "segmentación de precios"

## FLUJO DE TRABAJO

**Búsqueda simple:**
Usuario: "Precios de iPhone 15"
→ search_meli_products con query="iPhone 15"
→ Lista de productos con precios y links

**Comparación:**
Usuario: "Estoy caro vendiendo notebooks a $500.000?"
→ compare_meli_prices con productName="notebooks"
→ Análisis min/max/promedio + recomendación

**Análisis estratégico:**
Usuario: "¿Cómo está el mercado de aires acondicionados?"
→ get_meli_price_statistics
→ Distribución, volatilidad, rangos

## FORMATO DE RESPUESTA

**🛒 Productos:**
1. **[Título]** - $ XX.XXX
   - [Ver en MeLi](URL_EXACTA)

**📊 Análisis:**
- Precio promedio: $X.XXX
- Rango: $X - $Y
- Insights

## REGLAS
1. SIEMPRE usá los skills
2. URLs EXACTAS (no inventes)
3. Hablás en argentino informal 🛒💰`,
    })
    .eq('slug', 'meli');

  if (updateError) {
    console.error('❌ Error updating master_agents:', updateError);
    process.exit(1);
  }

  console.log('✅ master_agents.meli updated\n');

  // Step 2: Sync to tenant agents
  console.log('🔄 Syncing to tenant agents...');

  const { error: syncError } = await supabase.rpc('sync_agents_from_masters');

  if (syncError) {
    console.error('❌ Error syncing:', syncError);
    process.exit(1);
  }

  console.log('✅ Synced to all tenants\n');

  // Step 3: Verify
  console.log('🔍 Verifying migration...');

  const { data: masterAgent } = await supabase
    .from('master_agents')
    .select('slug, tools')
    .eq('slug', 'meli')
    .single();

  if (masterAgent) {
    console.log('✅ Master agent:', masterAgent);
  }

  const { data: tenantAgent } = await supabase
    .from('agents')
    .select('slug, tools, tenant_id')
    .eq('slug', 'meli')
    .limit(1)
    .single();

  if (tenantAgent) {
    console.log('✅ Tenant agent:', tenantAgent);
  }

  console.log('\n🎉 Migration complete!');
  console.log('\nMeli agent now uses:');
  console.log('  - search_meli_products');
  console.log('  - compare_meli_prices');
  console.log('  - get_meli_price_statistics');
}

applyMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
