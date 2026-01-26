/**
 * Skills Module - Atomic, Typed, Testable Skills
 *
 * This module provides the Skills architecture for Tuqui Agents.
 * Skills are deterministic functions that replace LLM-driven query generation.
 *
 * @example
 * ```typescript
 * import { globalRegistry, loadSkillsForTenant } from '@/lib/skills';
 *
 * // Get all skills for a tenant
 * const tools = loadSkillsForTenant(['odoo'], context);
 *
 * // Or get a specific skill
 * const skill = globalRegistry.get('get_sales_by_customer');
 * const result = await skill.execute(input, context);
 * ```
 */

// Core types
export * from './types';

// Error handling
export * from './errors';

// Registry
export {
  SkillRegistry,
  globalRegistry,
  skillsToAITools,
  loadSkillsForTenant,
  getSkillDescriptions,
  createRegistry,
  registerSkill,
  type AITool,
  type RegistryOptions,
} from './registry';

// Loader (for integration with chat route)
export {
  createSkillContext,
  loadSkillsForAgent,
  hasOdooTools,
  shouldUseSkills,
} from './loader';

// Odoo skills (for direct imports if needed)
export { odooSkills } from './odoo';
