/**
 * Skill: get_companies
 *
 * Lists available companies in Odoo (multi-company).
 * The LLM should call this FIRST to get the company ID
 * before filtering other skills by companyId.
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient } from './_client';
import { errorToResult } from '../errors';

export const GetCompaniesInputSchema = z.object({
  /** Max companies to return */
  limit: z.number().min(1).max(20).default(10),
});

export interface CompanyResult {
  id: number;
  name: string;
  currency: string;
}

export interface GetCompaniesOutput {
  companies: CompanyResult[];
  total: number;
}

export const getCompanies: Skill<typeof GetCompaniesInputSchema, GetCompaniesOutput> = {
  name: 'get_companies',

  description: `Lista las compañías disponibles en Odoo (multi-empresa).
LLAMAR PRIMERO para obtener el ID de la compañía antes de filtrar por companyId en otros skills.
USAR CUANDO: "ventas de [empresa]", "liquidez de [empresa]", "facturación de [empresa]",
"cuánto facturó [empresa]", cualquier pregunta que mencione una empresa/compañía/razón social específica.
NO adivinar el companyId — siempre llamar este skill primero.`,

  tool: 'odoo',
  inputSchema: GetCompaniesInputSchema,
  tags: ['companies', 'multi-company', 'config'],
  priority: 5,

  async execute(input, context): Promise<SkillResult<GetCompaniesOutput>> {
    if (!context.credentials.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      const companies = await odoo.searchRead<{
        id: number;
        name: string;
        currency_id: [number, string];
      }>('res.company', [], {
        fields: ['name', 'currency_id'],
        limit: input.limit,
      });

      const results: CompanyResult[] = companies.map((c) => ({
        id: c.id,
        name: c.name,
        currency: c.currency_id[1],
      }));

      const _descripcion = `EMPRESAS PROPIAS (multi-empresa): ${results.length} compañías disponibles${results.length > 0 ? `: ${results.map(c => `${c.name} (ID ${c.id}, ${c.currency})`).join(', ')}` : ''}. IMPORTANTE: son empresas propias (multi-empresa), NO son clientes ni proveedores.`;

      return success({ _descripcion, companies: results, total: results.length });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
