/**
 * Supabase Module Index
 * 
 * Unified Single-Database Architecture with RLS
 * 
 * ## Migration from Multi-DB
 * 
 * Old pattern (deprecated):
 * ```typescript
 * import { getTenantClient } from '@/lib/supabase'
 * const db = await getTenantClient(tenantId)
 * ```
 * 
 * New pattern (recommended):
 * ```typescript
 * import { getClient, setTenantContext } from '@/lib/supabase'
 * await setTenantContext(tenantId)
 * const db = getClient()
 * ```
 * 
 * Or with helper:
 * ```typescript
 * import { withTenant } from '@/lib/supabase'
 * const result = await withTenant(tenantId, async (db) => {
 *     return db.from('table').select('*')
 * })
 * ```
 */

// Main client and tenant functions
export {
    getClient,
    setTenantContext,
    withTenant,
    getTenantForUser,
    getTenantByPhone,
    getTenantByTwilioPhone,
    isUserAdmin,
    // Backwards compatibility
    getTenantClient,
    getMasterClient,
    // Types
    type TenantInfo,
    type UserTenantInfo,
} from './client'

// Alias for common patterns
export { getClient as supabaseAdmin } from './client'
