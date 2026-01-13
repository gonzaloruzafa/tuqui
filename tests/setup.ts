/**
 * Test Setup - Loads environment variables before tests run
 */
import { config } from 'dotenv'
import path from 'path'

// Load .env.local for test environment
config({ path: path.resolve(process.cwd(), '.env.local') })

console.log('✅ Environment loaded for tests')
console.log('   NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ set' : '✗ missing')
console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ set' : '✗ missing')
