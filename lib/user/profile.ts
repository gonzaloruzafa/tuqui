/**
 * User Profile CRUD
 * 
 * Manages user display name, role, area, bio.
 * Bio syncs to memory_facts for intelligent recall.
 */

import { getClient } from '@/lib/supabase/client'

export interface UserProfile {
  id: string
  user_id: string
  tenant_id: string
  display_name: string | null
  role_title: string | null
  area: string | null
  bio: string | null
  interests: string | null
  created_at: string
  updated_at: string
}

export interface UserProfileInput {
  display_name?: string
  role_title?: string
  area?: string
  bio?: string
  interests?: string
}

/** Get user profile, returns null if not created yet */
export async function getUserProfile(
  tenantId: string,
  userId: string
): Promise<UserProfile | null> {
  const db = getClient()
  const { data } = await db
    .from('user_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single()
  return data
}

/** Upsert user profile + sync bio to memory_facts */
export async function saveUserProfile(
  tenantId: string,
  userId: string,
  input: UserProfileInput
): Promise<UserProfile | null> {
  const db = getClient()

  const { data, error } = await db
    .from('user_profiles')
    .upsert({
      tenant_id: tenantId,
      user_id: userId,
      display_name: input.display_name || null,
      role_title: input.role_title || null,
      area: input.area || null,
      bio: input.bio || null,
      interests: input.interests || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,tenant_id' })
    .select()
    .single()

  if (error) {
    console.error('[UserProfile] Save error:', error)
    return null
  }

  // Sync bio to memory_facts for intelligent recall
  if (input.bio?.trim()) {
    await syncBioToMemory(tenantId, userId, input)
  }

  return data
}

/** 
 * Sync profile data to memory_facts so recall_memory can find it.
 * Uses entity_name='_user_profile' as a convention.
 */
async function syncBioToMemory(
  tenantId: string,
  userId: string,
  input: UserProfileInput
) {
  const db = getClient()
  const parts: string[] = []

  if (input.display_name) parts.push(`Se llama ${input.display_name}`)
  if (input.role_title) parts.push(`Cargo: ${input.role_title}`)
  if (input.area) parts.push(`Área: ${input.area}`)
  if (input.bio) parts.push(input.bio)

  const content = parts.join('. ').slice(0, 500)

  // Upsert: delete old profile memory, insert new one
  await db
    .from('memories')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('created_by', userId)
    .eq('entity_name', '_user_profile')

  await db
    .from('memories')
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      entity_name: '_user_profile',
      entity_type: 'general',
      content,
    })
}

/** Get minimal user context for prompt injection (~15 tokens)
 * userId can be either a users table UUID or an auth UUID — we try both */
export async function getUserContextTag(
  tenantId: string,
  userId: string
): Promise<string | null> {
  // Try direct match first (users table UUID)
  let profile = await getUserProfile(tenantId, userId)

  // If not found, userId might be an auth UUID — resolve it
  if (!profile) {
    const db = getClient()
    const { data: user } = await db
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', userId)
      .single()
    if (user) {
      profile = await getUserProfile(tenantId, user.id)
    }
  }

  if (!profile) return null

  const parts: string[] = []
  if (profile.display_name) parts.push(profile.display_name)
  if (profile.role_title) parts.push(profile.role_title)
  if (profile.area) parts.push(profile.area)
  if (profile.interests) parts.push(`Intereses: ${profile.interests}`)

  if (parts.length === 0) return null
  return `[Usuario: ${parts.join(' | ')}]`
}
