/**
 * Supabase Client - Unified Single-Database Architecture
 * 
 * This module provides a single Supabase client with tenant isolation via RLS.
 * 
 * ## Architecture
 * 
 * Before (Multi-DB):
 * - Master DB stored tenant credentials
 * - Each tenant had separate Supabase project
 * - getTenantClient() created clients dynamically
 * 
 * After (Single-DB + RLS):
 * - One Supabase project for all tenants
 * - tenant_id column on every table
 * - RLS policies filter by current_tenant_id()
 * - set_tenant_context() sets session variable
 * 
 * ## Usage
 * 
 * ```typescript
 * import { getClient, withTenant } from '@/lib/supabase/client'
 * 
 * // Option 1: Manual tenant context (for complex operations)
 * const db = getClient()
 * await db.rpc('set_tenant_context', { p_tenant_id: tenantId })
 * const { data } = await db.from('agents').select('*')
 * 
 * // Option 2: withTenant helper (recommended)
 * const agents = await withTenant(tenantId, async (db) => {
 *     const { data } = await db.from('agents').select('*')
 *     return data
 * })
 * 
 * // Option 3: Direct queries (when tenant context already set)
 * const { data } = await getClient().from('agents').select('*')
 * ```
 * 
 * ## Environment Variables
 * 
 * Required:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key (server-side only)
 * 
 * Optional (for client-side):
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Anon key for browser
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// =============================================================================
// SINGLETON CLIENT
// =============================================================================

let serverClient: SupabaseClient | null = null

/**
 * Get the Supabase client (singleton)
 * Uses service role key for server-side operations
 */
export function getClient(): SupabaseClient {
    if (serverClient) {
        return serverClient
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
        throw new Error(
            'Missing Supabase environment variables. ' +
            'Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
        )
    }

    serverClient = createClient(url, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    })

    return serverClient
}

// =============================================================================
// TENANT CONTEXT
// =============================================================================

/**
 * Set tenant context for the current session
 * Must be called before any tenant-scoped queries
 * Includes retry logic with exponential backoff for transient network failures
 * 
 * @param tenantId - UUID of the tenant
 * @param retries - Number of retry attempts (default: 3)
 */
export async function setTenantContext(tenantId: string, retries = 3): Promise<void> {
    const db = getClient()
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const { error } = await db.rpc('set_tenant_context', { p_tenant_id: tenantId })
            
            if (!error) return // Success
            
            // If it's the last attempt, throw
            if (attempt === retries) {
                console.error('[Supabase] Failed to set tenant context after retries:', error)
                throw new Error(`Failed to set tenant context: ${error.message}`)
            }
            
            // Wait before retry (exponential backoff: 200ms, 400ms, 800ms...)
            const delay = Math.pow(2, attempt) * 100
            console.warn(`[Supabase] Retry ${attempt}/${retries} in ${delay}ms...`)
            await new Promise(r => setTimeout(r, delay))
        } catch (fetchError: any) {
            // Network-level errors (fetch failed, socket closed, etc.)
            if (attempt === retries) {
                console.error('[Supabase] Network error in setTenantContext:', fetchError)
                throw new Error(`Failed to set tenant context: ${fetchError.message}`)
            }
            
            const delay = Math.pow(2, attempt) * 100
            console.warn(`[Supabase] Network error, retry ${attempt}/${retries} in ${delay}ms...`)
            await new Promise(r => setTimeout(r, delay))
        }
    }
}

/**
 * Execute operations with tenant context automatically set
 * 
 * @param tenantId - UUID of the tenant
 * @param operation - Async function that receives the client
 * @returns Result of the operation
 */
export async function withTenant<T>(
    tenantId: string,
    operation: (client: SupabaseClient) => Promise<T>
): Promise<T> {
    await setTenantContext(tenantId)
    return operation(getClient())
}

// =============================================================================
// TENANT LOOKUP (No tenant context required)
// =============================================================================

/**
 * Get tenant info for a user by email
 * Used during login to determine which tenant the user belongs to
 */
export async function getTenantForUser(email: string): Promise<{
    id: string
    name: string
    slug: string
} | null> {
    const db = getClient()
    
    // First get the user
    const { data: user, error: userError } = await db
        .from('users')
        .select('tenant_id')
        .eq('email', email)
        .single()

    if (userError || !user) {
        console.log(`[Supabase] No user found for email: ${email}`, userError?.message)
        return null
    }

    // Then get the tenant
    const { data: tenant, error: tenantError } = await db
        .from('tenants')
        .select('id, name, slug')
        .eq('id', user.tenant_id)
        .single()

    if (tenantError || !tenant) {
        console.log(`[Supabase] No tenant found for id: ${user.tenant_id}`, tenantError?.message)
        return null
    }

    return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug
    }
}

/**
 * Get tenant info by WhatsApp phone number
 * Used for WhatsApp webhook routing
 */
export async function getTenantByPhone(whatsappPhone: string): Promise<{
    id: string
    name: string
    slug: string
    userEmail: string
} | null> {
    const db = getClient()
    
    const { data: user, error } = await db
        .from('users')
        .select(`
            email,
            tenant_id,
            tenants!inner (
                id,
                name,
                slug
            )
        `)
        .eq('whatsapp_phone', whatsappPhone)
        .single()

    if (error || !user) {
        console.log(`[Supabase] No user found for phone: ${whatsappPhone}`)
        return null
    }

    const tenant = Array.isArray(user.tenants) ? user.tenants[0] : user.tenants
    if (!tenant) return null

    return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        userEmail: user.email
    }
}

/**
 * Get tenant by Twilio phone number (the number messages are sent TO)
 */
export async function getTenantByTwilioPhone(twilioPhone: string): Promise<{
    id: string
    name: string
    slug: string
} | null> {
    const db = getClient()
    
    const { data: tenant, error } = await db
        .from('tenants')
        .select('id, name, slug')
        .eq('twilio_phone', twilioPhone)
        .single()

    if (error || !tenant) {
        console.log(`[Supabase] No tenant found for Twilio phone: ${twilioPhone}`)
        return null
    }

    return tenant
}

/**
 * Check if user is admin
 */
export async function isUserAdmin(email: string): Promise<boolean> {
    const db = getClient()
    
    const { data: user } = await db
        .from('users')
        .select('is_admin')
        .eq('email', email)
        .single()

    return user?.is_admin || false
}

// =============================================================================
// BACKWARDS COMPATIBILITY
// =============================================================================

/**
 * @deprecated Use getClient() + setTenantContext() instead
 * 
 * This function provides backwards compatibility during migration.
 * It sets the tenant context and returns the client.
 */
export async function getTenantClient(tenantId: string): Promise<SupabaseClient> {
    await setTenantContext(tenantId)
    return getClient()
}

/**
 * @deprecated Use getClient() instead
 * 
 * Alias for backwards compatibility with code that used getMasterClient()
 */
export function getMasterClient(): SupabaseClient {
    return getClient()
}

// =============================================================================
// TYPES
// =============================================================================

export interface TenantInfo {
    id: string
    name: string
    slug: string
}

export interface UserTenantInfo extends TenantInfo {
    userEmail: string
}
