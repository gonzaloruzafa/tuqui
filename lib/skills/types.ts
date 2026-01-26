/**
 * Skills Type System
 *
 * Base types and interfaces for the atomic Skills architecture.
 * Skills are typed, testable, deterministic functions that replace
 * the LLM-driven query generation of the old "God Tools" approach.
 *
 * @example
 * ```typescript
 * const skill: Skill<typeof MyInputSchema, MyOutput> = {
 *   name: 'my_skill',
 *   description: 'Does something specific',
 *   tool: 'odoo',
 *   inputSchema: MyInputSchema,
 *   execute: async (input, context) => {
 *     // Deterministic logic here
 *     return { success: true, data: result };
 *   }
 * };
 * ```
 */

import { z } from 'zod';

// ============================================
// CONTEXT TYPES
// ============================================

/**
 * Odoo connection credentials (already decrypted)
 */
export interface OdooCredentials {
  url: string;
  db: string;
  username: string;
  apiKey: string;
}

/**
 * MercadoLibre API credentials (future use)
 */
export interface MeliCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * All possible integration credentials
 */
export interface TenantCredentials {
  odoo?: OdooCredentials;
  mercadolibre?: MeliCredentials;
  // Future: google?, stripe?, etc.
}

/**
 * Context passed to every skill execution
 * Contains user identity and tenant-specific credentials
 */
export interface SkillContext {
  /** Current user's ID */
  userId: string;
  /** Current tenant's ID */
  tenantId: string;
  /** Decrypted credentials for enabled integrations */
  credentials: TenantCredentials;
  /** User's locale for formatting (default: 'es-AR') */
  locale?: string;
}

// ============================================
// RESULT TYPES
// ============================================

/**
 * Error codes for skill failures
 */
export type SkillErrorCode =
  | 'AUTH_ERROR'       // Missing or invalid credentials
  | 'VALIDATION_ERROR' // Input validation failed
  | 'API_ERROR'        // External API call failed
  | 'NOT_FOUND'        // Requested resource doesn't exist
  | 'RATE_LIMIT'       // Too many requests
  | 'TIMEOUT'          // Operation timed out
  | 'INTERNAL_ERROR';  // Unexpected error

/**
 * Standardized error object
 */
export interface SkillError {
  code: SkillErrorCode;
  message: string;
  details?: unknown;
  /** If true, the operation can be retried */
  retryable?: boolean;
}

/**
 * Success result wrapper
 */
export interface SkillSuccess<T> {
  success: true;
  data: T;
  /** Optional metadata about the execution */
  metadata?: {
    /** Execution time in milliseconds */
    executionMs?: number;
    /** Whether result came from cache */
    cached?: boolean;
    /** Source system version/info */
    source?: string;
  };
}

/**
 * Failure result wrapper
 */
export interface SkillFailure {
  success: false;
  error: SkillError;
}

/**
 * Union type for skill results - either success or failure
 */
export type SkillResult<T> = SkillSuccess<T> | SkillFailure;

// ============================================
// SKILL DEFINITION
// ============================================

/**
 * Core skill interface
 *
 * @template TInput - Zod schema for input validation
 * @template TOutput - TypeScript type for the output data
 */
export interface Skill<TInput extends z.ZodType, TOutput> {
  /** Unique identifier (snake_case) */
  name: string;

  /**
   * Human-readable description used by LLM to decide when to use this skill.
   * Should include example phrases that trigger this skill.
   * @example "Get sales grouped by customer. Use when user asks 'top customers', 'who bought most'."
   */
  description: string;

  /** Parent tool category (odoo, meli, calendar, etc.) */
  tool: string;

  /** Zod schema for input validation */
  inputSchema: TInput;

  /**
   * Execute the skill with validated input
   * This should contain DETERMINISTIC logic - no LLM calls inside.
   */
  execute: (
    input: z.infer<TInput>,
    context: SkillContext
  ) => Promise<SkillResult<TOutput>>;

  /**
   * Optional: Tags for categorization and filtering
   * @example ['sales', 'reporting', 'aggregation']
   */
  tags?: string[];

  /**
   * Optional: Priority for skill selection (higher = preferred)
   * Used when multiple skills could handle the same query
   */
  priority?: number;
}

// ============================================
// COMMON INPUT SCHEMAS
// ============================================

/**
 * Date period specification (ISO format)
 */
export const PeriodSchema = z.object({
  /** Start date YYYY-MM-DD */
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  /** End date YYYY-MM-DD */
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  /** Optional human-readable label */
  label: z.string().optional(),
});

export type Period = z.infer<typeof PeriodSchema>;

/**
 * Pagination options
 */
export const PaginationSchema = z.object({
  /** Maximum number of results (1-500) */
  limit: z.number().min(1).max(500).default(50),
  /** Offset for pagination */
  offset: z.number().min(0).default(0),
});

export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * Order/state filter for transactional documents
 */
export const DocumentStateSchema = z.enum([
  'all',        // Include all states
  'confirmed',  // Only confirmed/posted (sale, posted, purchase)
  'draft',      // Only drafts/quotes
  'cancelled',  // Only cancelled
]);

export type DocumentState = z.infer<typeof DocumentStateSchema>;

// ============================================
// COMMON OUTPUT TYPES
// ============================================

/**
 * Grouped aggregation result (common for sales by X, invoices by X, etc.)
 */
export interface GroupedAmount {
  id: number;
  name: string;
  count: number;
  total: number;
}

/**
 * Summary with total and count
 */
export interface AmountSummary {
  total: number;
  count: number;
  period?: Period;
}

/**
 * Comparison between two periods
 */
export interface PeriodComparison {
  current: AmountSummary;
  previous: AmountSummary;
  variation: {
    absolute: number;
    percent: number;
    trend: 'up' | 'down' | 'stable';
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a success result
 */
export function success<T>(data: T, metadata?: SkillSuccess<T>['metadata']): SkillResult<T> {
  return { success: true, data, metadata };
}

/**
 * Create a failure result
 */
export function failure(
  code: SkillErrorCode,
  message: string,
  details?: unknown
): SkillResult<never> {
  return {
    success: false,
    error: { code, message, details },
  };
}

/**
 * Create an auth error result
 */
export function authError(integration: string): SkillResult<never> {
  return failure(
    'AUTH_ERROR',
    `${integration} credentials not configured for this tenant`
  );
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T>(result: SkillResult<T>): result is SkillSuccess<T> {
  return result.success === true;
}

/**
 * Type guard to check if result is a failure
 */
export function isFailure<T>(result: SkillResult<T>): result is SkillFailure {
  return result.success === false;
}
