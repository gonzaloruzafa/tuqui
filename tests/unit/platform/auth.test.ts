import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockMaybeSingle = vi.fn()
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockEqAdmin = vi.fn(() => ({ limit: mockLimit }))
const mockEqEmail = vi.fn(() => ({ eq: mockEqAdmin }))
const mockSelect = vi.fn(() => ({ eq: mockEqEmail }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

describe('isPlatformAdmin', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    mockMaybeSingle.mockReset()
  })

  test('returns true when user has is_platform_admin in DB', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { is_platform_admin: true } })
    const { isPlatformAdmin } = await import('@/lib/platform/auth')
    expect(await isPlatformAdmin('admin@test.com')).toBe(true)
  })

  test('returns true via env var fallback when not in DB', async () => {
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', 'fallback@test.com')
    mockMaybeSingle.mockResolvedValue({ data: null })
    const { isPlatformAdmin } = await import('@/lib/platform/auth')
    expect(await isPlatformAdmin('fallback@test.com')).toBe(true)
  })

  test('returns false for non-admin email', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null })
    const { isPlatformAdmin } = await import('@/lib/platform/auth')
    expect(await isPlatformAdmin('user@test.com')).toBe(false)
  })

  test('returns false for null/undefined', async () => {
    const { isPlatformAdmin } = await import('@/lib/platform/auth')
    expect(await isPlatformAdmin(null)).toBe(false)
    expect(await isPlatformAdmin(undefined)).toBe(false)
  })

  test('is case-insensitive', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { is_platform_admin: true } })
    const { isPlatformAdmin } = await import('@/lib/platform/auth')
    expect(await isPlatformAdmin('ADMIN@TEST.COM')).toBe(true)
  })
})
