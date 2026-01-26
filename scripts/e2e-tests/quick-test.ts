/**
 * Quick Conversation Test
 *
 * Simple script for quick manual testing of conversation flows.
 * Executes a single multi-turn conversation and prints results.
 *
 * Usage:
 *   tsx scripts/e2e-tests/quick-test.ts
 */

import { processChatRequest, ChatMessage } from '@/lib/chat/engine';

// ============================================
// CONFIGURATION
// ============================================

const TEST_CONFIG = {
  tenantId: process.env.TEST_TENANT_ID || 'your-tenant-id-here',
  userEmail: process.env.TEST_USER_EMAIL || 'test@example.com',

  agentConfig: {
    id: 'test-agent',
    slug: 'odoo-assistant',
    name: 'Odoo Assistant',
    tenant_id: 'test-tenant-id',
    system_prompt: `Sos un asistente de Odoo experto.
Fecha actual: {{CURRENT_DATE}}.
Ayudás a los usuarios con consultas de ventas, inventario, facturación y compras.
Siempre usá los tools disponibles para obtener datos reales de Odoo.`,
    tools: ['odoo', 'web_search'],
    rag_enabled: false,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

// ============================================
// QUICK TEST CONVERSATION
// ============================================

const QUICK_TEST_TURNS = [
  '¿Cuánto vendimos este mes?',
  '¿Quiénes fueron los mejores clientes?',
  '¿Qué productos compró el primero?',
  'Mostrame el stock de esos productos',
];

// ============================================
// EXECUTION
// ============================================

async function quickTest() {
  console.log('\n🚀 Quick Conversation Test\n');
  console.log(`Tenant: ${TEST_CONFIG.tenantId}`);
  console.log(`User: ${TEST_CONFIG.userEmail}\n`);
  console.log('='* 80);

  const conversationHistory: ChatMessage[] = [];

  for (let i = 0; i < QUICK_TEST_TURNS.length; i++) {
    const userMessage = QUICK_TEST_TURNS[i];

    console.log(`\n--- Turn ${i + 1}/${QUICK_TEST_TURNS.length} ---\n`);
    console.log(`👤 User: ${userMessage}`);

    // Add user message
    conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
      const startTime = Date.now();

      // Call chat engine
      const response = await processChatRequest({
        tenantId: TEST_CONFIG.tenantId,
        userEmail: TEST_CONFIG.userEmail,
        agent: TEST_CONFIG.agentConfig as any,
        messages: conversationHistory,
        channel: 'web',
      });

      const duration = Date.now() - startTime;

      // Add assistant response
      conversationHistory.push({
        role: 'assistant',
        content: response.text,
        tool_calls: response.toolCalls,
      });

      console.log(`\n🤖 Assistant:\n${response.text}\n`);

      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log(`🔧 Tools Called:`);
        response.toolCalls.forEach(tc => {
          console.log(`   - ${tc.skillName || 'unknown'}`);
        });
      }

      console.log(`\n⏱️  Duration: ${duration}ms`);
      console.log(`📊 Tokens: ${response.usage?.totalTokens || 'N/A'}`);

    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(error);
      break;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Quick test completed!\n');
}

// ============================================
// RUN
// ============================================

quickTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
