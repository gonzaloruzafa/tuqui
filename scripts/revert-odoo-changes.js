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

console.log('🔄 Reverting problematic Odoo changes...\n');

(async () => {
  try {
    // 1. Leer el prompt actual
    const { data: currentAgent, error: fetchError } = await supabase
      .from('master_agents')
      .select('system_prompt')
      .eq('slug', 'odoo')
      .single();

    if (fetchError) {
      console.error('❌ Error fetching Odoo agent:', fetchError);
      process.exit(1);
    }

    console.log('📝 Current prompt length:', currentAgent.system_prompt.length, 'characters');

    // 2. Remover el prepend de migration 123 (todo lo que está después de "## 🚨 REGLA CRÍTICA")
    let cleanedPrompt = currentAgent.system_prompt;

    // Encontrar y remover la sección agregada por migration 123
    const criticalRuleStart = cleanedPrompt.indexOf('## 🚨 REGLA CRÍTICA ABSOLUTA');
    if (criticalRuleStart > 0) {
      // Buscar hacia atrás el separador "---"
      let separatorPos = cleanedPrompt.lastIndexOf('---', criticalRuleStart);
      if (separatorPos > 0) {
        cleanedPrompt = cleanedPrompt.substring(0, separatorPos).trim();
        console.log('✅ Removed migration 123 prepend');
        console.log('📝 New prompt length:', cleanedPrompt.length, 'characters');
      }
    }

    // 3. Actualizar el prompt en la base de datos
    const { data, error } = await supabase
      .from('master_agents')
      .update({
        system_prompt: cleanedPrompt,
        version: currentAgent.version + 1
      })
      .eq('slug', 'odoo')
      .select();

    if (error) {
      console.error('❌ Error updating Odoo agent:', error);
      process.exit(1);
    }

    console.log('✅ Odoo agent prompt reverted!');
    console.log('📊 Updated', data && data.length || 0, 'record(s)');

    console.log('\n✅ Revert completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Revert router.ts changes manually if needed');
    console.log('2. Run E2E tests to establish clean baseline');
    console.log('3. Create integral improvement plan based on results');

  } catch (err) {
    console.error('❌ Exception:', err.message);
    process.exit(1);
  }
})();
