/**
 * Skill Error Handling
 *
 * Provides utilities for creating, wrapping, and handling errors
 * in a consistent way across all skills.
 */

import type { SkillError, SkillErrorCode, SkillResult } from './types';
import { failure } from './types';

// ============================================
// ERROR CLASSES
// ============================================

/**
 * Base class for skill-related errors
 * Can be thrown and caught, then converted to SkillResult
 */
export class SkillExecutionError extends Error {
  public readonly code: SkillErrorCode;
  public readonly details?: unknown;
  public readonly retryable: boolean;

  constructor(
    code: SkillErrorCode,
    message: string,
    details?: unknown,
    retryable = false
  ) {
    super(message);
    this.name = 'SkillExecutionError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }

  toSkillError(): SkillError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
    };
  }

  toResult<T>(): SkillResult<T> {
    return {
      success: false,
      error: this.toSkillError(),
    };
  }
}

/**
 * Authentication/credentials error
 */
export class AuthenticationError extends SkillExecutionError {
  constructor(integration: string, details?: unknown) {
    super(
      'AUTH_ERROR',
      `${integration} credentials not configured or invalid`,
      details,
      false // Auth errors are not retryable
    );
    this.name = 'AuthenticationError';
  }
}

/**
 * Input validation error
 */
export class ValidationError extends SkillExecutionError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, details, false);
    this.name = 'ValidationError';
  }
}

/**
 * External API error (Odoo, MeLi, etc.)
 */
export class ApiError extends SkillExecutionError {
  public readonly statusCode?: number;

  constructor(
    message: string,
    details?: unknown,
    statusCode?: number,
    retryable = false
  ) {
    super('API_ERROR', message, details, retryable);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends SkillExecutionError {
  constructor(resource: string, identifier: string | number) {
    super(
      'NOT_FOUND',
      `${resource} with ID ${identifier} not found`,
      { resource, identifier },
      false
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends SkillExecutionError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super('RATE_LIMIT', message, { retryAfter }, true);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends SkillExecutionError {
  constructor(operation: string, timeoutMs: number) {
    super(
      'TIMEOUT',
      `${operation} timed out after ${timeoutMs}ms`,
      { timeoutMs },
      true
    );
    this.name = 'TimeoutError';
  }
}

// ============================================
// ERROR HANDLING UTILITIES
// ============================================

/**
 * Convert any error to a SkillResult
 * Useful in catch blocks to ensure consistent error handling
 */
export function errorToResult<T>(error: unknown): SkillResult<T> {
  if (error instanceof SkillExecutionError) {
    return error.toResult();
  }

  if (error instanceof Error) {
    // Check for common error patterns
    const message = error.message.toLowerCase();

    if (message.includes('authentication') || message.includes('unauthorized')) {
      return failure('AUTH_ERROR', error.message, error);
    }

    if (message.includes('not found') || message.includes('does not exist')) {
      return failure('NOT_FOUND', error.message, error);
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return failure('TIMEOUT', error.message, error);
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return failure('RATE_LIMIT', error.message, error);
    }

    // Default to API_ERROR for unknown errors
    return failure('API_ERROR', error.message, {
      name: error.name,
      stack: error.stack,
    });
  }

  // Unknown error type
  return failure('INTERNAL_ERROR', 'An unexpected error occurred', error);
}

/**
 * Wrap an async function with error handling
 * Ensures any thrown error is converted to a SkillResult
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>
): Promise<SkillResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return errorToResult(error);
  }
}

/**
 * Extract a meaningful error message from Odoo RPC errors
 */
export function parseOdooError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;

    // Odoo RPC error format: "Odoo RPC Error: <message>"
    const rpcMatch = message.match(/Odoo RPC Error:\s*(.+)/);
    if (rpcMatch) {
      return rpcMatch[1];
    }

    // Field error format: "Invalid field 'xyz'"
    const fieldMatch = message.match(/Invalid field[:\s]*['"]?(\w+)['"]?/i);
    if (fieldMatch) {
      return `Invalid field: ${fieldMatch[1]}`;
    }

    // Access error
    if (message.includes('Access Denied') || message.includes('AccessError')) {
      return 'Access denied. Check user permissions in Odoo.';
    }

    return message;
  }

  return String(error);
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof SkillExecutionError) {
    return error.retryable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  }

  return false;
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !isRetryableError(error)) {
        throw error;
      }

      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt - 1),
        maxDelayMs
      );

      onRetry?.(attempt, error);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
