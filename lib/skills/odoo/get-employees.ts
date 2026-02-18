/**
 * Skill: get_employees
 *
 * List employees with job info, department, manager, contact.
 *
 * Use cases:
 * - "¿Quiénes trabajan acá?"
 * - "Empleados del departamento de ventas"
 * - "¿Quién es el gerente de marketing?"
 */

import { z } from 'zod';
import type { Skill, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient, type OdooDomain } from './_client';
import { errorToResult } from '../errors';

export const GetEmployeesInputSchema = z.object({
  /** Filter by department name (partial match) */
  department: z.string().optional(),
  /** Only active employees */
  activeOnly: z.boolean().default(true),
  /** Max results */
  limit: z.number().int().min(1).max(100).default(50),
});

export interface EmployeeRow {
  id: number;
  name: string;
  jobTitle: string | null;
  department: string | null;
  manager: string | null;
  workEmail: string | null;
  workPhone: string | null;
  company: string | null;
}

export interface GetEmployeesOutput {
  employees: EmployeeRow[];
  total: number;
}

export const getEmployees: Skill<typeof GetEmployeesInputSchema, GetEmployeesOutput> = {
  name: 'get_employees',
  description: `Lista EMPLEADOS de la empresa con cargo, departamento, manager y contacto.
USAR PARA: "empleados", "quiénes trabajan", "equipo de X", "organigrama", "staff".
Devuelve: nombre, cargo, departamento, manager, email laboral, teléfono.`,
  tool: 'odoo',
  tags: ['hr', 'employees'],
  inputSchema: GetEmployeesInputSchema,

  async execute(input): Promise<SkillResult<GetEmployeesOutput>> {
    if (!('odoo' in (this as any)?.credentials || true)) { /* handled below */ }
    const context = arguments[1];
    if (!context?.credentials?.odoo) return authError('Odoo');

    try {
      const odoo = createOdooClient(context.credentials.odoo);
      const domain: OdooDomain = [];

      if (input.activeOnly) domain.push(['active', '=', true]);
      if (input.department) domain.push(['department_id.name', 'ilike', input.department]);

      const rows = await odoo.searchRead<{
        id: number;
        name: string;
        job_title: string | false;
        department_id: [number, string] | false;
        parent_id: [number, string] | false;
        work_email: string | false;
        work_phone: string | false;
        company_id: [number, string] | false;
      }>(
        'hr.employee',
        domain,
        {
          fields: ['name', 'job_title', 'department_id', 'parent_id', 'work_email', 'work_phone', 'company_id'],
          limit: input.limit,
          order: 'name asc',
        }
      );

      const employees: EmployeeRow[] = rows.map(r => ({
        id: r.id,
        name: r.name,
        jobTitle: r.job_title || null,
        department: r.department_id ? r.department_id[1] : null,
        manager: r.parent_id ? r.parent_id[1] : null,
        workEmail: r.work_email || null,
        workPhone: r.work_phone || null,
        company: r.company_id ? r.company_id[1] : null,
      }));

      const byDept: Record<string, number> = {};
      employees.forEach(e => {
        const d = e.department || 'Sin departamento';
        byDept[d] = (byDept[d] || 0) + 1;
      });
      const deptSummary = Object.entries(byDept)
        .sort((a, b) => b[1] - a[1])
        .map(([d, c]) => `${d}: ${c}`)
        .join(', ');

      const _descripcion = `La empresa tiene ${employees.length} empleados. Distribución por departamento: ${deptSummary}. Cargos: ${[...new Set(employees.map(e => e.jobTitle).filter(Boolean))].slice(0, 15).join(', ')}.`;

      return success({ _descripcion, employees, total: employees.length });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
