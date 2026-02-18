/**
 * Skill: get_users
 *
 * List Odoo users with login, groups, and active status.
 *
 * Use cases:
 * - "¿Qué usuarios hay en Odoo?"
 * - "¿Quién tiene acceso?"
 * - "Usuarios activos del sistema"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

export const GetUsersInputSchema = z.object({
  /** Only active users */
  activeOnly: z.boolean().default(true),
  /** Exclude portal/public users (share=true) */
  internalOnly: z.boolean().default(true),
  /** Max results */
  limit: z.number().int().min(1).max(200).default(100),
});

export interface UserRow {
  id: number;
  name: string;
  login: string;
  active: boolean;
  isInternal: boolean;
  company: string | null;
  groupCount: number;
}

export interface GetUsersOutput {
  users: UserRow[];
  total: number;
}

export const getUsers: Skill<typeof GetUsersInputSchema, GetUsersOutput> = {
  name: 'get_users',
  description: `Lista USUARIOS del sistema Odoo con su login, estado y si son internos o portal.
USAR PARA: "usuarios", "quién tiene acceso", "logins", "usuarios activos", "cuántos usuarios hay", "qué hace cada uno".
Devuelve: nombre, login, activo, interno/portal, empresa, cantidad de grupos.`,
  tool: 'odoo',
  tags: ['users', 'config'],
  inputSchema: GetUsersInputSchema,

  async execute(input): Promise<SkillResult<GetUsersOutput>> {
    const context = arguments[1];
    if (!context?.credentials?.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const domain: OdooDomain = [];

      if (input.activeOnly) domain.push(['active', '=', true]);
      if (input.internalOnly) domain.push(['share', '=', false]);

      const rows = await odoo.searchRead<{
        id: number;
        name: string;
        login: string;
        active: boolean;
        share: boolean;
        company_id: [number, string] | false;
        groups_id: number[];
      }>(
        'res.users',
        domain,
        {
          fields: ['name', 'login', 'active', 'share', 'company_id', 'groups_id'],
          limit: input.limit,
          order: 'name asc',
        }
      );

      const users: UserRow[] = rows.map(r => ({
        id: r.id,
        name: r.name,
        login: r.login,
        active: r.active,
        isInternal: !r.share,
        company: r.company_id ? r.company_id[1] : null,
        groupCount: r.groups_id?.length || 0,
      }));

      const internal = users.filter(u => u.isInternal).length;
      const portal = users.filter(u => !u.isInternal).length;

      const _descripcion = `El sistema tiene ${users.length} usuarios${input.internalOnly ? ' internos' : ''} (${internal} internos, ${portal} portal/externos). Usuarios: ${users.map(u => `${u.name} (${u.login})`).slice(0, 20).join(', ')}.`;

      return success({ _descripcion, users, total: users.length });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
