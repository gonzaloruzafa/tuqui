/**
 * Tests for Skill Registry
 * 
 * Validates the clampNumericInputs helper and skill-to-tool conversion.
 */

import { describe, test, expect } from 'vitest';
import { z } from 'zod';
import { skillsToAITools } from '../../lib/skills/registry';
import type { Skill, SkillContext } from '../../lib/skills/types';

// ============================================
// HELPERS
// ============================================

const mockContext: SkillContext = {
  userId: 'test-user',
  tenantId: 'test-tenant',
  credentials: {},
};

function createTestSkill(schema: z.ZodType): Skill<any, any> {
  return {
    name: 'test_skill',
    description: 'Test skill',
    tool: 'test',
    inputSchema: schema,
    execute: async (input) => ({ success: true as const, data: input }),
  };
}

async function execTool(tools: Record<string, any>, input: unknown) {
  const result = await tools.test_skill.execute(input, mockContext);
  return result;
}

// ============================================
// TESTS: clampNumericInputs (via skillsToAITools)
// ============================================

describe('Skill Registry - Numeric Input Clamping', () => {
  const schema = z.object({
    limit: z.number().int().min(1).max(100).default(50),
    name: z.string().optional(),
  });

  test('clamps limit exceeding .max() to max value', async () => {
    const skill = createTestSkill(schema);
    const tools = skillsToAITools([skill], mockContext);
    const result = await execTool(tools, { limit: 9999 });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(100);
  });

  test('clamps limit below .min() to min value', async () => {
    const skill = createTestSkill(schema);
    const tools = skillsToAITools([skill], mockContext);
    const result = await execTool(tools, { limit: -5 });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(1);
  });

  test('passes valid limit through unchanged', async () => {
    const skill = createTestSkill(schema);
    const tools = skillsToAITools([skill], mockContext);
    const result = await execTool(tools, { limit: 50 });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(50);
  });

  test('uses default when limit not provided', async () => {
    const skill = createTestSkill(schema);
    const tools = skillsToAITools([skill], mockContext);
    const result = await execTool(tools, { name: 'test' });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(50);
  });

  test('handles schema with .max(20) correctly', async () => {
    const smallSchema = z.object({
      limit: z.number().min(1).max(20).default(5),
    });
    const skill = createTestSkill(smallSchema);
    const tools = skillsToAITools([skill], mockContext);
    const result = await execTool(tools, { limit: 500 });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(20);
  });

  test('handles optional numeric fields', async () => {
    const optSchema = z.object({
      limit: z.number().min(1).max(50).default(10).optional(),
    });
    const skill = createTestSkill(optSchema);
    const tools = skillsToAITools([skill], mockContext);
    const result = await execTool(tools, { limit: 200 });
    expect(result.success).toBe(true);
  });

  test('does not clamp non-numeric fields', async () => {
    const skill = createTestSkill(schema);
    const tools = skillsToAITools([skill], mockContext);
    const result = await execTool(tools, { limit: 10, name: 'hello' });
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('hello');
  });
});
