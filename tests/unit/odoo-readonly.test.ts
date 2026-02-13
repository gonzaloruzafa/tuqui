import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/skills/errors', () => ({
  AuthenticationError: class extends Error { constructor(msg: string) { super(msg); this.name = 'AuthenticationError' } },
}))

describe('Odoo Read-Only Guard', () => {
  let SkillOdooClient: any

  beforeEach(async () => {
    vi.restoreAllMocks()
    const mod = await import('@/lib/skills/odoo/_client')
    SkillOdooClient = mod.SkillOdooClient
  })

  const client = () => new SkillOdooClient({
    url: 'https://test.odoo.com',
    db: 'test',
    username: 'test',
    apiKey: 'test-key',
  })

  const safe = ['search_read', 'read', 'search_count', 'fields_get', 'read_group']
  const dangerous = ['create', 'write', 'unlink', 'copy', 'action_confirm']

  test.each(dangerous)('bloquea método de escritura: %s', async (method) => {
    await expect(client().execute('res.partner', method, []))
      .rejects.toThrow(/read-only/)
  })

  test.each(safe)('no bloquea método de lectura: %s', async (method) => {
    // Should fail on auth (no real server), NOT on read-only guard
    await expect(client().execute('res.partner', method, []))
      .rejects.not.toThrow(/read-only/)
  })
})
