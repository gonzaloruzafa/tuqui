/**
 * Skills Loader - Load and prepare skills for tenant execution
 *
 * This module handles:
 * - Loading tenant credentials from integrations table
 * - Creating SkillContext with proper multi-tenant isolation
 * - Converting skills to AI SDK tool format
 */

import { getClient } from '@/lib/supabase/client';
import { decrypt } from '@/lib/crypto';
import type { SkillContext, TenantCredentials, OdooCredentials } from './types';
import { loadSkillsForTenant, skillsToAITools } from './registry';

// ============================================
// CREDENTIAL LOADING
// ============================================

/**
 * Load Odoo credentials for a tenant
 */
async function loadOdooCredentials(tenantId: string): Promise<OdooCredentials | undefined> {
  try {
    const db = getClient();

    const { data: integration, error } = await db
      .from('integrations')
      .select('config, is_active')
      .eq('tenant_id', tenantId)
      .eq('type', 'odoo')
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      console.log(`[Skills/Loader] No active Odoo integration for tenant ${tenantId}`);
      return undefined;
    }

    const config = integration.config;

    // Decrypt API key
    const apiKey = decrypt(config.odoo_password || config.api_key || '');

    return {
      url: config.odoo_url || config.url,
      db: config.odoo_db || config.db,
      username: config.odoo_user || config.username,
      apiKey,
    };
  } catch (error) {
    console.error('[Skills/Loader] Error loading Odoo credentials:', error);
    return undefined;
  }
}

/**
 * Load all credentials for enabled integrations
 */
async function loadTenantCredentials(tenantId: string): Promise<TenantCredentials> {
  const credentials: TenantCredentials = {};

  // Load Odoo credentials if integration is active
  const odoo = await loadOdooCredentials(tenantId);
  if (odoo) {
    credentials.odoo = odoo;
  }

  // Future: Load other integrations (MercadoLibre, Google, etc.)
  // const meli = await loadMeliCredentials(tenantId);
  // if (meli) credentials.mercadolibre = meli;

  return credentials;
}

// ============================================
// SKILL CONTEXT CREATION
// ============================================

/**
 * Create a SkillContext for a tenant and user
 *
 * @param tenantId - Tenant ID
 * @param userId - User ID (email)
 * @returns SkillContext with loaded credentials
 */
export async function createSkillContext(
  tenantId: string,
  userId: string
): Promise<SkillContext> {
  const credentials = await loadTenantCredentials(tenantId);

  return {
    userId,
    tenantId,
    credentials,
    locale: 'es-AR', // Default locale, could be user-specific
  };
}

// ============================================
// SKILL LOADING FOR AGENTS
// ============================================

/**
 * Get enabled tools (integrations) from agent configuration
 *
 * @param agentTools - Array of tool slugs (e.g., ['odoo', 'web_search'])
 * @returns Array of enabled tool names
 */
function getEnabledToolsFromAgentConfig(agentTools: string[]): string[] {
  const enabledTools: string[] = [];

  // Map agent tool slugs to skill tool names
  for (const tool of agentTools) {
    if (tool.startsWith('odoo')) {
      enabledTools.push('odoo');
    }
    // Future: Map other tools
    // if (tool.startsWith('meli')) enabledTools.push('meli');
  }

  return [...new Set(enabledTools)]; // Deduplicate
}

/**
 * Load skills for an agent as AI SDK tools
 *
 * @param tenantId - Tenant ID
 * @param userId - User ID (email)
 * @param agentTools - Array of tool slugs configured for the agent
 * @returns Record of AI SDK tools keyed by skill name
 */
export async function loadSkillsForAgent(
  tenantId: string,
  userId: string,
  agentTools: string[]
): Promise<Record<string, any>> {
  // Create skill context with tenant credentials
  const context = await createSkillContext(tenantId, userId);

  // Determine which tool categories are enabled
  const enabledTools = getEnabledToolsFromAgentConfig(agentTools);

  console.log('[Skills/Loader] Loading skills for tenant:', {
    tenantId,
    agentTools,
    enabledTools,
    hasOdoo: !!context.credentials.odoo,
  });

  // If no credentials available, return empty
  if (Object.keys(context.credentials).length === 0) {
    console.warn('[Skills/Loader] No credentials available for tenant');
    return {};
  }

  // Load and convert skills to AI SDK format
  const tools = loadSkillsForTenant(enabledTools, context);

  console.log('[Skills/Loader] Loaded skills:', Object.keys(tools));

  return tools;
}

// ============================================
// INTEGRATION DETECTION
// ============================================

/**
 * Check if agent has Odoo tools configured
 *
 * @param agentTools - Array of tool slugs
 * @returns True if agent uses any Odoo tool
 */
export function hasOdooTools(agentTools: string[]): boolean {
  return agentTools.some((t) => t.startsWith('odoo'));
}

/**
 * Check if tenant should use Skills architecture
 * This is a feature flag to gradually migrate from God Tool to Skills
 *
 * @param tenantId - Tenant ID
 * @returns True if tenant should use Skills
 */
export async function shouldUseSkills(tenantId: string): Promise<boolean> {
  // For now, enable Skills for all tenants
  // Can be made configurable via tenant settings
  return true;

  // Future: Feature flag from database
  // const db = getClient();
  // const { data } = await db
  //   .from('tenants')
  //   .select('feature_flags')
  //   .eq('id', tenantId)
  //   .single();
  // return data?.feature_flags?.use_skills === true;
}
