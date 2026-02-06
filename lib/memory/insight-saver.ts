import { getClient } from '@/lib/supabase/client';

/**
 * Extract and save business insights from conversation history.
 * This runs in the background to build the agent's memory.
 */
export async function extractAndSaveInsights(
  tenantId: string,
  userId: string | null,
  messages: { role: string; content: string }[]
): Promise<void> {
  // Only process if we have messages
  if (!messages || messages.length < 2) return;

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUserMessage) return;

  // Simple rule-based extraction for the MVP
  // In a future version, this could be done by an LLM
  const patterns = [
    { type: 'customer', regex: /(cliente|empresa|partner)\s+([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*)\s+(siempre|nunca|suele|paga|prefiere|compra|pide)\s+([^.!?]+)/i },
    { type: 'product', regex: /(producto|artículo|item)\s+([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*)\s+(siempre|nunca|suele|falla|prefiere|se vende|rota)\s+([^.!?]+)/i },
    { type: 'supplier', regex: /(proveedor|vendedor)\s+([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*)\s+(siempre|nunca|suele|entrega|demora|trae)\s+([^.!?]+)/i },
  ];

  const db = getClient();

  for (const { type, regex } of patterns) {
    const match = lastUserMessage.content.match(regex);
    if (match) {
      const entityName = match[2];
      const insight = `${match[3]} ${match[4]}`.trim();

      console.log(`[InsightSaver] Extracted insight for ${entityName}: ${insight}`);

      await db.from('conversation_insights').insert({
        tenant_id: tenantId,
        user_id: userId,
        entity_type: type,
        entity_name: entityName,
        insight: insight,
        confidence: 0.7
      });
    }
  }
}
