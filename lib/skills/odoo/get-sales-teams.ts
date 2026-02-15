/**
 * Skill: get_sales_teams
 *
 * Retrieves available sales teams with their order counts.
 * Helps the user filter sales data by team (ecommerce, tienda web, etc.)
 *
 * @example
 * User: "¿Qué equipos de venta tenemos?"
 * User: "¿Cuáles son las tiendas/canales de venta?"
 * User: "Ventas del ecommerce" -> first get teams, then filter sales
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, formatMonto } from './_client';
import { errorToResult } from '../errors';

// ============================================
// INPUT SCHEMA
// ============================================

export const GetSalesTeamsInputSchema = z.object({
  /** Include order counts per team */
  includeStats: z.boolean().default(true),
  /** Only teams with orders */
  activeOnly: z.boolean().default(false),
});

export type GetSalesTeamsInput = z.infer<typeof GetSalesTeamsInputSchema>;

// ============================================
// OUTPUT TYPE
// ============================================

export interface SalesTeam {
  id: number;
  name: string;
  /** Number of orders for this team (if includeStats) */
  orderCount?: number;
  /** Total revenue for this team (if includeStats) */
  totalRevenue?: number;
}

export interface GetSalesTeamsOutput {
  teams: SalesTeam[];
  totalTeams: number;
}

// ============================================
// SKILL IMPLEMENTATION
// ============================================

export const getSalesTeams: Skill<
  typeof GetSalesTeamsInputSchema,
  GetSalesTeamsOutput
> = {
  name: 'get_sales_teams',

  description: `Lista equipos de venta disponibles (ecommerce, tienda física, etc.).
USAR PARA: "qué equipos de venta hay", "canales de venta", "tiendas", 
"ventas por canal", "necesito filtrar por equipo".
Retorna: lista de equipos con ID, nombre y estadísticas opcionales.
IMPORTANTE: Usar el ID del equipo como teamId en otros skills de ventas.`,

  tool: 'odoo',

  inputSchema: GetSalesTeamsInputSchema,

  tags: ['sales', 'teams', 'channels', 'lookup'],

  priority: 10,

  async execute(
    input: GetSalesTeamsInput,
    context: SkillContext
  ): Promise<SkillResult<GetSalesTeamsOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      // Get sales teams
      const teams = await odoo.searchRead(
        'crm.team',
        [],
        { fields: ['id', 'name'], order: 'name asc' }
      );

      if (!input.includeStats) {
        const _descripcion = `EQUIPOS de venta: ${teams.length} equipos encontrados (sin estadísticas). IMPORTANTE: son equipos/departamentos internos, NO son clientes ni proveedores.`;

        return success({
          _descripcion,
          teams: teams.map((t: any) => ({
            id: t.id,
            name: t.name,
          })),
          totalTeams: teams.length,
        });
      }

      // Get order counts and revenue per team
      const teamStats = await odoo.readGroup(
        'sale.order',
        [['state', 'in', ['sale', 'done']]],
        ['team_id', 'amount_total:sum'],
        ['team_id'],
        { limit: 100 }
      );

      const statsMap = new Map<number, { count: number; total: number }>();
      for (const stat of teamStats) {
        if (stat.team_id) {
          statsMap.set(stat.team_id[0], {
            count: stat.__count || 0,
            total: stat.amount_total || 0,
          });
        }
      }

      const teamsWithStats: SalesTeam[] = teams.map((t: any) => ({
        id: t.id,
        name: t.name,
        orderCount: statsMap.get(t.id)?.count || 0,
        totalRevenue: statsMap.get(t.id)?.total || 0,
      }));

      // Filter only active teams if requested
      const result = input.activeOnly
        ? teamsWithStats.filter((t) => (t.orderCount || 0) > 0)
        : teamsWithStats;

      const _descripcion = `EQUIPOS de venta: ${result.length} equipos, revenue total ${formatMonto(result.reduce((s, t) => s + (t.totalRevenue || 0), 0))}. IMPORTANTE: son equipos/departamentos internos, NO son clientes ni proveedores.`;

      return success({
        _descripcion,
        teams: result,
        totalTeams: result.length,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};

export default getSalesTeams;
