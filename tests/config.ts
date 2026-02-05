/**
 * Test Configuration
 * 
 * Centralized test constants to avoid hardcoding across test files.
 */

// Tenant ID for tests - use environment variable or default to Adhoc tenant
export const TEST_TENANT_ID = process.env.TEST_TENANT_ID || 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

// API URLs
export const TUQUI_API_URL = process.env.TUQUI_API_URL || 'https://tuqui.vercel.app/api/internal/chat-test'
export const INTERNAL_TEST_KEY = process.env.INTERNAL_TEST_KEY || 'test-key-change-in-prod'

// Timeouts
export const DEFAULT_TIMEOUT = 30000  // 30 seconds
export const LONG_TIMEOUT = 60000     // 60 seconds for complex queries
