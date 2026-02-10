/**
 * Memory Tools Factory
 *
 * Creates AI SDK compatible tools for the memory skill.
 * Called from executor.ts when agent has 'memory' in tools[].
 */

import { recallMemory, RecallMemoryInputSchema, recallMemoryDescription } from './recall'
import { saveMemory, SaveMemoryInputSchema, saveMemoryDescription } from './save'

/**
 * Create memory tools bound to a specific tenant and user
 */
export function createMemoryTools(tenantId: string, userId: string) {
  return {
    recall_memory: {
      description: recallMemoryDescription,
      parameters: RecallMemoryInputSchema,
      execute: async (input: unknown) => {
        const parsed = RecallMemoryInputSchema.safeParse(input)
        if (!parsed.success) {
          return { success: false, error: 'Invalid input' }
        }
        return recallMemory(parsed.data, tenantId, userId)
      },
    },
    save_memory: {
      description: saveMemoryDescription,
      parameters: SaveMemoryInputSchema,
      execute: async (input: unknown) => {
        const parsed = SaveMemoryInputSchema.safeParse(input)
        if (!parsed.success) {
          return { success: false, error: 'Invalid input' }
        }
        return saveMemory(parsed.data, tenantId, userId)
      },
    },
  }
}
