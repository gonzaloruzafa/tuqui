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

const migrationPath = path.join(__dirname, '../supabase/migrations/123_advanced_query_examples.sql');
const sqlFull = fs.readFileSync(migrationPath, 'utf8');

// Extract the prompt from SQL
const match = sqlFull.match(/SET system_prompt = '([\s\S]*?)' WHERE slug = 'odoo'/);
if (!match) {
  console.error('❌ Could not extract prompt from SQL');
  process.exit(1);
}

const newPrompt = match[1];

console.log('📝 Applying migration 123 to master_agents...');

(async () => {
  try {
    const { data, error } = await supabase
      .from('master_agents')
      .update({ system_prompt: newPrompt })
      .eq('slug', 'odoo')
      .select();

    if (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }

    console.log('✅ Migration 123 applied successfully!');
    console.log(`📊 Updated ${data?.length || 0} record(s)`);

  } catch (err) {
    console.error('❌ Exception:', err.message);
    process.exit(1);
  }
})();
