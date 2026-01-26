/**
 * Skill Registry
 *
 * Central registry for all skills. Provides:
 * - Dynamic skill loading based on tenant configuration
 * - Conversion to Vercel AI SDK tool format
 * - Skill lookup by name or tool
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from './types';

// ============================================
// TYPES
// ============================================

/**
 * AI SDK tool definition (compatible with Vercel AI SDK)
 */
export interface AITool {
  description: string;
  parameters: z.ZodType;
  execute: (input: unknown, context: SkillContext) => Promise<SkillResult<any>>;
}

/**
 * Registry options
 */
export interface RegistryOptions {
  /** Only load skills for these tools */
  enabledTools?: string[];
  /** Only load skills with these tags */
  requiredTags?: string[];
}

// ============================================
// SKILL IMPORTS
// ============================================

// Odoo Skills
import { odooSkills } from './odoo';

// ============================================
// MASTER REGISTRY
// ============================================

/**
 * All registered skills
 * Add new skill arrays here as they are implemented
 */
const ALL_SKILLS: Skill<any, any>[] = [
  ...odooSkills,
  // Future: ...meliSkills,
  // Future: ...calendarSkills,
];

// ============================================
// REGISTRY CLASS
// ============================================

/**
 * Skill Registry - manages skill loading and lookup
 */
export class SkillRegistry {
  private skills: Map<string, Skill<any, any>> = new Map();
  private skillsByTool: Map<string, Skill<any, any>[]> = new Map();

  constructor(skills: Skill<any, any>[] = ALL_SKILLS) {
    this.registerSkills(skills);
  }

  /**
   * Register multiple skills
   */
  registerSkills(skills: Skill<any, any>[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * Register a single skill
   */
  register(skill: Skill<any, any>): void {
    // Add to name lookup
    this.skills.set(skill.name, skill);

    // Add to tool grouping
    if (!this.skillsByTool.has(skill.tool)) {
      this.skillsByTool.set(skill.tool, []);
    }
    this.skillsByTool.get(skill.tool)!.push(skill);
  }

  /**
   * Get skill by name
   */
  get(name: string): Skill<any, any> | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all skills for a specific tool
   */
  getByTool(tool: string): Skill<any, any>[] {
    return this.skillsByTool.get(tool) || [];
  }

  /**
   * Get all registered skills
   */
  getAll(): Skill<any, any>[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills filtered by options
   */
  getFiltered(options: RegistryOptions = {}): Skill<any, any>[] {
    let skills = this.getAll();

    // Filter by enabled tools
    if (options.enabledTools?.length) {
      skills = skills.filter((s) => options.enabledTools!.includes(s.tool));
    }

    // Filter by required tags
    if (options.requiredTags?.length) {
      skills = skills.filter((s) =>
        options.requiredTags!.some((tag) => s.tags?.includes(tag))
      );
    }

    return skills;
  }

  /**
   * Get list of all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.skillsByTool.keys());
  }

  /**
   * Check if a skill exists
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Get skill count
   */
  get size(): number {
    return this.skills.size;
  }
}

// ============================================
// GLOBAL REGISTRY INSTANCE
// ============================================

/**
 * Default global registry with all skills
 */
export const globalRegistry = new SkillRegistry();

// ============================================
// CONVERSION FUNCTIONS
// ============================================

/**
 * Convert skills to Vercel AI SDK tool format
 *
 * @param skills - Skills to convert
 * @param context - Execution context (will be bound to each tool)
 */
export function skillsToAITools(
  skills: Skill<any, any>[],
  context: SkillContext
): Record<string, AITool> {
  const tools: Record<string, AITool> = {};

  for (const skill of skills) {
    tools[skill.name] = {
      description: skill.description,
      parameters: skill.inputSchema,
      execute: async (input: unknown) => {
        // Validate input
        const parsed = skill.inputSchema.safeParse(input);
        if (!parsed.success) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR' as const,
              message: 'Invalid input parameters',
              details: parsed.error.format(),
            },
          };
        }

        // Execute with context
        return skill.execute(parsed.data, context);
      },
    };
  }

  return tools;
}

/**
 * Load skills for a tenant based on their enabled integrations
 *
 * @param enabledTools - List of tool slugs enabled for the tenant
 * @param context - Skill execution context
 */
export function loadSkillsForTenant(
  enabledTools: string[],
  context: SkillContext
): Record<string, AITool> {
  const skills = globalRegistry.getFiltered({ enabledTools });
  return skillsToAITools(skills, context);
}

/**
 * Get skill descriptions for LLM prompt injection
 * Useful for helping the LLM understand available capabilities
 */
export function getSkillDescriptions(skills: Skill<any, any>[]): string {
  const lines = ['## Available Skills\n'];

  // Group by tool
  const byTool = new Map<string, Skill<any, any>[]>();
  for (const skill of skills) {
    if (!byTool.has(skill.tool)) {
      byTool.set(skill.tool, []);
    }
    byTool.get(skill.tool)!.push(skill);
  }

  for (const [tool, toolSkills] of Array.from(byTool.entries())) {
    lines.push(`### ${tool.toUpperCase()}`);
    for (const skill of toolSkills) {
      lines.push(`- **${skill.name}**: ${skill.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a new registry with only specific skills
 * Useful for testing or creating tool-specific registries
 */
export function createRegistry(skills: Skill<any, any>[]): SkillRegistry {
  return new SkillRegistry(skills);
}

/**
 * Register a skill to the global registry
 * Use this when dynamically adding skills
 */
export function registerSkill(skill: Skill<any, any>): void {
  globalRegistry.register(skill);
}
