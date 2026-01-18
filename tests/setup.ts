/**
 * Test Setup - Loads environment variables before tests run
 * 
 * For live Odoo tests, set TEST_TENANT_ID in .env.local
 */
import { config } from 'dotenv'
import path from 'path'

// Load .env.local for test environment
config({ path: path.resolve(process.cwd(), '.env.local') })

// Export test configuration
export const TEST_TENANT_ID = process.env.TEST_TENANT_ID
export const SKIP_LIVE_TESTS = !TEST_TENANT_ID

console.log('✅ Environment loaded for tests')
console.log('   NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ set' : '✗ missing')
console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ set' : '✗ missing')
console.log('   TEST_TENANT_ID:', TEST_TENANT_ID ? '✓ set (live tests enabled)' : '✗ not set (live tests skipped)')
