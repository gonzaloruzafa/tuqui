/**
 * Skill: get_departments
 *
 * List HR departments with manager and employee count.
 *
 * Use cases:
 * - "¿Qué departamentos hay?"
 * - "¿Quién lidera cada área?"
 * - "Estructura organizacional"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient } from './_client';
import { errorToResult } from '../errors';

export const GetDepartmentsInputSchema = z.object({
  /** Max results */
  limit: z.number().int().min(1).max(50).default(50),
});

export interface DepartmentRow {
  id: number;
  name: string;
  completeName: string | null;
  manager: string | null;
  totalEmployees: number;
  company: string | null;
}

export interface GetDepartmentsOutput {
  departments: DepartmentRow[];
  total: number;
}

export const getDepartments: Skill<typeof GetDepartmentsInputSchema, GetDepartmentsOutput> = {
  name: 'get_departments',
  description: `Lista DEPARTAMENTOS de la empresa con manager y cantidad de empleados.
USAR PARA: "departamentos", "áreas", "organigrama", "estructura", "quién lidera cada área".
Devuelve: nombre, nombre completo (jerárquico), manager, cantidad de empleados, empresa.`,
  tool: 'odoo',
  tags: ['hr', 'departments'],
  inputSchema: GetDepartmentsInputSchema,

  async execute(input): Promise<SkillResult<GetDepartmentsOutput>> {
    const context = arguments[1];
    if (!context?.credentials?.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      const rows = await odoo.searchRead<{
        id: number;
        name: string;
        complete_name: string | false;
        manager_id: [number, string] | false;
        total_employee: number;
        company_id: [number, string] | false;
      }>(
        'hr.department',
        [],
        {
          fields: ['name', 'complete_name', 'manager_id', 'total_employee', 'company_id'],
          limit: input.limit,
          order: 'total_employee desc',
        }
      );

      const departments: DepartmentRow[] = rows.map(r => ({
        id: r.id,
        name: r.name,
        completeName: r.complete_name || null,
        manager: r.manager_id ? r.manager_id[1] : null,
        totalEmployees: r.total_employee,
        company: r.company_id ? r.company_id[1] : null,
      }));

      const totalEmps = departments.reduce((s, d) => s + d.totalEmployees, 0);
      const lines = departments
        .map(d => `${d.name}: ${d.totalEmployees} empleados${d.manager ? ` (manager: ${d.manager})` : ''}`)
        .join(', ');

      const _descripcion = `La empresa tiene ${departments.length} departamentos con ${totalEmps} empleados en total. ${lines}.`;

      return success({ _descripcion, departments, total: departments.length });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
