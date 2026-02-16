/**
 * Skill: search_suppliers
 *
 * Search for suppliers (proveedores) by name, email, or VAT.
 * Symmetric to search_customers but filters by supplier_rank.
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

export const SearchSuppliersInputSchema = z.object({
  /** Search query (name, email, VAT, reference) */
  query: z.string().min(1),
  /** Maximum number of results */
  limit: z.number().int().min(1).max(50).default(10),
  /** Only active suppliers */
  activeOnly: z.boolean().default(true),
});

export interface SupplierResult {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  vat: string | null;
  city: string | null;
  isCompany: boolean;
}

export interface SearchSuppliersOutput {
  suppliers: SupplierResult[];
  total: number;
}

export const searchSuppliers: Skill<typeof SearchSuppliersInputSchema, SearchSuppliersOutput> = {
  name: 'search_suppliers',

  description: `Busca PROVEEDORES por nombre, email, CUIT o referencia.
USAR PARA: "buscar proveedor", "proveedor que se llama", "proveedor Cotisen", "supplier X".
Para buscar CLIENTES usar search_customers (son herramientas distintas).
Devuelve: nombre, email, teléfono, CUIT, ciudad.`,

  tool: 'odoo',
  tags: ['suppliers', 'search', 'purchases'],
  inputSchema: SearchSuppliersInputSchema,

  async execute(input, context): Promise<SkillResult<SearchSuppliersOutput>> {
    if (!context.credentials.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      const domain: OdooDomain = [
        '|', '|', '|',
        ['name', 'ilike', input.query],
        ['email', 'ilike', input.query],
        ['vat', 'ilike', input.query],
        ['ref', 'ilike', input.query],
        ['supplier_rank', '>', 0],
      ];

      if (input.activeOnly) {
        domain.push(['active', '=', true]);
      }

      const suppliers = await odoo.searchRead<{
        id: number;
        name: string;
        email: string | false;
        phone: string | false;
        vat: string | false;
        city: string | false;
        is_company: boolean;
      }>('res.partner', domain, {
        fields: ['name', 'email', 'phone', 'vat', 'city', 'is_company'],
        limit: input.limit,
      });

      const results: SupplierResult[] = suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email || null,
        phone: s.phone || null,
        vat: s.vat || null,
        city: s.city || null,
        isCompany: s.is_company,
      }));

      const _descripcion = `Búsqueda de proveedores "${input.query}": ${results.length} resultados encontrados${results.length > 0 ? `. Primeros: ${results.slice(0, 3).map(s => s.name).join(', ')}` : ''}. IMPORTANTE: son PROVEEDORES a quienes les compramos, NO son clientes.`;

      return success({ _descripcion, suppliers: results, total: results.length });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
