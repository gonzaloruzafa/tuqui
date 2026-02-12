/**
 * Unit Tests for Agent Sync (ensureAgentsForTenant)
 *
 * Verifies that when master_agents are updated (version bump),
 * tenant agent instances get synced with new description, name, etc.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// --- Mock data ---

const MASTER_ODOO = {
  id: 'master-odoo-id',
  slug: 'odoo',
  name: 'Odoo ERP',
  description: 'Consultas de DATOS numéricos del ERP Odoo: ventas, facturas, stock, deudas.',
  icon: '📊',
  color: '#8B5CF6',
  system_prompt: 'Sos un experto en Odoo.',
  welcome_message: null,
  placeholder_text: null,
  tools: ['odoo'],
  is_published: true,
  sort_order: 4,
  version: 3,
}

// --- Mock setup ---

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
})

const mockInsert = vi.fn().mockResolvedValue({ error: null })

// Controls what the agents.select().eq().eq().single() returns
let agentLookupResult: any = null
// Controls what agents.select('*, master_agents(*)').eq().single() returns (for sync join)
let agentWithMasterResult: any = null

vi.mock('@/lib/supabase/client', () => ({
  getClient: () => ({
    from: (table: string) => {
      if (table === 'master_agents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [MASTER_ODOO],
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'agents') {
        return {
          select: vi.fn().mockImplementation((selectStr: string) => {
            // Join query for syncAgentWithMaster: select('*, master_agents(*)')
            if (selectStr?.includes('master_agents')) {
              return {
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockImplementation(() =>
                    Promise.resolve({ data: agentWithMasterResult, error: null })
                  ),
                }),
              }
            }
            // Simple query for ensureAgentsForTenant: select('id, master_version_synced')
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockImplementation(() =>
                    Promise.resolve(
                      agentLookupResult
                        ? { data: agentLookupResult, error: null }
                        : { data: null, error: { code: 'PGRST116' } }
                    )
                  ),
                }),
              }),
            }
          }),
          update: mockUpdate,
          insert: mockInsert,
        }
      }
      return {}
    },
  }),
  getTenantClient: vi.fn().mockResolvedValue({
    from: () => ({}),
  }),
}))

// Import AFTER mocks
import { ensureAgentsForTenant } from '@/lib/agents/service'

// Use unique tenant IDs per test to avoid the 5-min in-memory cache
let testCounter = 0
function uniqueTenantId() {
  return `test-tenant-${++testCounter}`
}

describe('Agent Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('syncs description when master version is newer', async () => {
    agentLookupResult = { id: 'agent-1', master_version_synced: 1 }
    agentWithMasterResult = {
      id: 'agent-1',
      slug: 'odoo',
      description: 'OLD description',
      master_agents: MASTER_ODOO,
    }

    await ensureAgentsForTenant(uniqueTenantId())

    expect(mockUpdate).toHaveBeenCalled()
    const payload = mockUpdate.mock.calls[0][0]
    expect(payload).toMatchObject({
      name: MASTER_ODOO.name,
      description: MASTER_ODOO.description,
      system_prompt: MASTER_ODOO.system_prompt,
      tools: MASTER_ODOO.tools,
      master_version_synced: MASTER_ODOO.version,
    })
  })

  test('description field is explicitly included in sync payload', async () => {
    agentLookupResult = { id: 'agent-2', master_version_synced: 1 }
    agentWithMasterResult = {
      id: 'agent-2',
      slug: 'odoo',
      description: 'Consultas de datos empresariales desde Odoo',
      master_agents: MASTER_ODOO,
    }

    await ensureAgentsForTenant(uniqueTenantId())

    const payload = mockUpdate.mock.calls[0][0]
    expect(payload).toHaveProperty('description')
    expect(payload.description).toBe(MASTER_ODOO.description)
    expect(payload.description).not.toBe('Consultas de datos empresariales desde Odoo')
  })

  test('creates new agent with master description', async () => {
    agentLookupResult = null // no existing agent

    await ensureAgentsForTenant(uniqueTenantId())

    expect(mockInsert).toHaveBeenCalled()
    const payload = mockInsert.mock.calls[0][0]
    expect(payload).toMatchObject({
      slug: 'odoo',
      description: MASTER_ODOO.description,
      master_version_synced: MASTER_ODOO.version,
    })
  })

  test('skips sync when versions match', async () => {
    agentLookupResult = { id: 'agent-3', master_version_synced: MASTER_ODOO.version }

    await ensureAgentsForTenant(uniqueTenantId())

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
