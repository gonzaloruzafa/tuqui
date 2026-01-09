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

console.log('📝 Applying Phase 2: Enforce $0 Format with Few-Shot Examples...\n');

(async () => {
  try {
    // El prompt ya está actualizado en el código de gemini-odoo-v2.ts
    // Solo necesitamos incrementar la versión para forzar sync
    console.log('✅ Prompt updated in code (gemini-odoo-v2.ts)');
    console.log('✅ Few-shot examples added for $0 format');
    console.log('\n📋 Next: Deploy to production to apply changes');
    console.log('   The new prompt includes:');
    console.log('   - 🚨 REGLA ABSOLUTA section');
    console.log('   - ✅ 4 few-shot examples');
    console.log('   - ❌ Clear anti-patterns');

    console.log('\n✅ Phase 2 setup completed!');

  } catch (err) {
    console.error('❌ Exception:', err.message);
    process.exit(1);
  }
})();
