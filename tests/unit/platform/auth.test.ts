import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock next-auth dependency chain
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
  })

  test('returns true for configured admin email', async () => {
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', 'admin@test.com,other@test.com')
    const { isPlatformAdmin } = await import('@/lib/platform/auth')
    expect(isPlatformAdmin('admin@test.com')).toBe(true)
  })

  test('returns true case-insensitive', async () => {
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', 'admin@test.com')
    const { isPlatformAdmin } = await import('@/lib/platform/auth')
    expect(isPlatformAdmin('ADMIN@TEST.COM')).toBe(true)
  })

  test('returns false for non-admin email', async () => {
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', 'admin@test.com')
    const { isPlatformAdmin } = await import('@/lib/platform/auth')
    expect(isPlatformAdmin('user@test.com')).toBe(false)
  })

  test('returns false for null/undefined', async () => {
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', 'admin@test.com')
    const { isPlatformAdmin } = await import('@/lib/platform/auth')
    expect(isPlatformAdmin(null)).toBe(false)
    expect(isPlatformAdmin(undefined)).toBe(false)
  })

  test('falls back to default email when env not set', async () => {
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', '')
    const { isPlatformAdmin } = await import('@/lib/platform/auth')
    expect(isPlatformAdmin('gr@adhoc.inc')).toBe(true)
  })
})
