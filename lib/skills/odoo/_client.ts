/**
 * Odoo Client Factory for Skills
 *
 * Creates OdooClient instances from SkillContext credentials.
 * This is a thin wrapper that adapts the existing OdooClient
 * to work with the Skills architecture.
 *
 * The actual OdooClient implementation is reused from lib/tools/odoo/client.ts
 * to avoid code duplication.
 */

import type { OdooCredentials, SkillContext } from '../types';
import { AuthenticationError } from '../errors';

// ============================================
// TYPES
// ============================================

/**
 * Domain filter tuple: [field, operator, value]
 */
export type DomainFilter = [string, string, any];

/**
 * Full domain is an array of filters, with optional '|' or '&' operators
 */
export type OdooDomain = (DomainFilter | '|' | '&')[];

/**
 * Read group result from Odoo
 */
export interface ReadGroupResult {
  [key: string]: any;
  __count?: number;
  __domain?: DomainFilter[];
}

/**
 * Options for read_group operation
 */
export interface ReadGroupOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  lazy?: boolean;
}

/**
 * Options for search_read operation
 */
export interface SearchReadOptions {
  fields?: string[];
  limit?: number;
  offset?: number;
  order?: string;
}

// ============================================
// ODOO CLIENT
// ============================================

/**
 * Lightweight Odoo JSON-RPC client for Skills
 * Provides typed methods for common operations
 */
export class SkillOdooClient {
  private url: string;
  private db: string;
  private username: string;
  private apiKey: string;
  private uid: number | null = null;

  constructor(credentials: OdooCredentials) {
    this.url = credentials.url.replace(/\/$/, '');
    this.db = credentials.db;
    this.username = credentials.username;
    this.apiKey = credentials.apiKey;
  }

  /**
   * Execute JSON-RPC call with automatic retry for transient errors
   */
  private async rpc(service: string, method: string, ...args: any[]): Promise<any> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(`${this.url}/jsonrpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: { service, method, args },
            id: Math.floor(Math.random() * 1000000),
          }),
        });

        // Retry on transient HTTP errors
        if (res.status === 429 || res.status >= 502) {
          if (attempt < maxRetries) {
            await this.sleep(attempt * 1000);
            continue;
          }
        }

        if (!res.ok) {
          throw new Error(`Odoo HTTP Error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        if (data.error) {
          const errorMsg = data.error.data?.message || data.error.message || 'Unknown error';
          throw new Error(`Odoo RPC Error: ${errorMsg}`);
        }

        return data.result;
      } catch (error: any) {
        lastError = error;

        // Retry on network errors
        const isNetworkError = error.name === 'TypeError' || error.message?.includes('fetch');
        if (isNetworkError && attempt < maxRetries) {
          await this.sleep(attempt * 1000);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Odoo RPC failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Authenticate and cache the user ID
   */
  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;

    this.uid = await this.rpc(
      'common',
      'authenticate',
      this.db,
      this.username,
      this.apiKey,
      {}
    );

    if (!this.uid) {
      throw new AuthenticationError('Odoo', { username: this.username });
    }

    return this.uid;
  }

  /**
   * Execute any Odoo model method
   */
  async execute(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {}
  ): Promise<any> {
    const uid = await this.authenticate();
    return this.rpc(
      'object',
      'execute_kw',
      this.db,
      uid,
      this.apiKey,
      model,
      method,
      args,
      kwargs
    );
  }

  /**
   * Search and read records with filters
   */
  async searchRead<T = Record<string, any>>(
    model: string,
    domain: OdooDomain = [],
    options: SearchReadOptions = {}
  ): Promise<T[]> {
    const { fields = [], limit = 50, offset = 0, order } = options;
    return this.execute(model, 'search_read', [domain], {
      fields,
      limit,
      offset,
      order,
    });
  }

  /**
   * Aggregate with GROUP BY (server-side aggregation)
   *
   * @param model - Odoo model name
   * @param domain - Filter domain
   * @param fields - Fields to select/aggregate (e.g., ['partner_id', 'amount_total:sum'])
   * @param groupBy - Fields to group by (e.g., ['partner_id', 'date_order:month'])
   * @param options - Limit, offset, order
   */
  async readGroup(
    model: string,
    domain: OdooDomain = [],
    fields: string[] = [],
    groupBy: string[] = [],
    options: ReadGroupOptions = {}
  ): Promise<ReadGroupResult[]> {
    const { limit = 80, offset = 0, orderBy, lazy = true } = options;
    return this.execute(model, 'read_group', [domain], {
      fields,
      groupby: groupBy,
      limit,
      offset,
      orderby: orderBy,
      lazy,
    });
  }

  /**
   * Count records matching domain (faster than searchRead for counts)
   */
  async searchCount(model: string, domain: OdooDomain = []): Promise<number> {
    return this.execute(model, 'search_count', [domain]);
  }

  /**
   * Get field definitions for a model
   */
  async fieldsGet(
    model: string,
    attributes: string[] = ['string', 'type', 'relation']
  ): Promise<Record<string, any>> {
    return this.execute(model, 'fields_get', [], { attributes });
  }

  /**
   * Read specific records by IDs
   */
  async read<T = Record<string, any>>(
    model: string,
    ids: number[],
    fields: string[] = []
  ): Promise<T[]> {
    return this.execute(model, 'read', [ids], { fields });
  }

  /**
   * Create a new record
   */
  async create(model: string, values: Record<string, any>): Promise<number> {
    return this.execute(model, 'create', [values]);
  }

  /**
   * Update existing records
   */
  async write(
    model: string,
    ids: number[],
    values: Record<string, any>
  ): Promise<boolean> {
    return this.execute(model, 'write', [ids, values]);
  }

  /**
   * Delete records
   */
  async unlink(model: string, ids: number[]): Promise<boolean> {
    return this.execute(model, 'unlink', [ids]);
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

/**
 * Create an OdooClient from SkillContext credentials
 * Throws AuthenticationError if credentials are missing
 */
export function createOdooClient(credentials: OdooCredentials): SkillOdooClient {
  return new SkillOdooClient(credentials);
}

/**
 * Get OdooClient from SkillContext, with credential validation
 */
export function getOdooClientFromContext(context: SkillContext): SkillOdooClient {
  if (!context.credentials.odoo) {
    throw new AuthenticationError('Odoo');
  }
  return createOdooClient(context.credentials.odoo);
}

// ============================================
// DOMAIN BUILDER HELPERS
// ============================================

/**
 * Build a date range filter
 */
export function dateRange(
  field: string,
  start: string,
  end: string
): DomainFilter[] {
  return [
    [field, '>=', start],
    [field, '<=', end],
  ];
}

/**
 * Build a state filter for documents
 */
export function stateFilter(
  state: 'all' | 'confirmed' | 'draft' | 'cancelled',
  model: 'sale.order' | 'purchase.order' | 'account.move'
): DomainFilter[] {
  if (state === 'all') return [];

  const stateMap: Record<string, Record<string, string | string[]>> = {
    'sale.order': {
      confirmed: ['sale', 'done'],
      draft: 'draft',
      cancelled: 'cancel',
    },
    'purchase.order': {
      confirmed: ['purchase', 'done'],
      draft: 'draft',
      cancelled: 'cancel',
    },
    'account.move': {
      confirmed: 'posted',
      draft: 'draft',
      cancelled: 'cancel',
    },
  };

  const value = stateMap[model]?.[state];
  if (!value) return [];

  return Array.isArray(value)
    ? [['state', 'in', value]]
    : [['state', '=', value]];
}

/**
 * Build invoice type filter
 */
export function invoiceTypeFilter(
  type: 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund' | 'all'
): DomainFilter[] {
  if (type === 'all') return [];
  return [['move_type', '=', type]];
}

/**
 * Combine multiple domain filters
 */
export function combineDomains(...domains: (DomainFilter[] | undefined)[]): OdooDomain {
  return domains
    .filter((d): d is DomainFilter[] => d !== undefined && d.length > 0)
    .flat();
}
