/**
 * Skill: get_crm_tags
 *
 * Lists available CRM tags — auxiliary lookup skill.
 * Same pattern as get_sales_teams: provides IDs so other skills can filter.
 */

import { z } from 'zod';
import type { Skill, SkillContext, SkillResult } from '../types';
import { success, authError } from '../types';
import { createOdooClient } from './_client';
import { errorToResult } from '../errors';

export const GetCrmTagsInputSchema = z.object({
  /** Include opportunity count per tag */
  includeStats: z.boolean().default(true),
});

export type GetCrmTagsInput = z.infer<typeof GetCrmTagsInputSchema>;

export interface CrmTag {
  id: number;
  name: string;
  /** Number of open opportunities with this tag */
  opportunityCount?: number;
}

export interface GetCrmTagsOutput {
  tags: CrmTag[];
  totalTags: number;
}

export const getCrmTags: Skill<
  typeof GetCrmTagsInputSchema,
  GetCrmTagsOutput
> = {
  name: 'get_crm_tags',

  description: `Lista etiquetas disponibles del CRM con la cantidad de oportunidades de cada una.
USAR PARA: "qué etiquetas hay en el CRM", "tags del pipeline", "categorías de oportunidades".
IMPORTANTE: SIEMPRE llamar antes de filtrar oportunidades por etiqueta.
Retorna ID y nombre de cada tag para usar como tagId en search_crm_opportunities.`,

  tool: 'odoo',
  tags: ['crm', 'tags', 'lookup'],
  inputSchema: GetCrmTagsInputSchema,
  priority: 10,

  async execute(
    input: GetCrmTagsInput,
    context: SkillContext
  ): Promise<SkillResult<GetCrmTagsOutput>> {
    if (!context.credentials.odoo) {
      return authError('Odoo');
    }

    try {
      const odoo = createOdooClient(context.credentials.odoo);

      const tags = await odoo.searchRead<{ id: number; name: string }>(
        'crm.tag',
        [],
        { fields: ['id', 'name'], order: 'name asc' }
      );

      if (!input.includeStats) {
        return success({
          tags: tags.map((t) => ({ id: t.id, name: t.name })),
          totalTags: tags.length,
        });
      }

      // Get opportunity count per tag
      const tagCounts = await odoo.readGroup(
        'crm.lead',
        [['type', '=', 'opportunity'], ['active', '=', true], ['probability', '<', 100]],
        ['tag_ids'],
        ['tag_ids'],
        { limit: 100 }
      );

      const countMap = new Map<number, number>();
      for (const g of tagCounts) {
        if (g.tag_ids) {
          const tagId = Array.isArray(g.tag_ids) ? g.tag_ids[0] : g.tag_ids;
          countMap.set(tagId, g.tag_ids_count || g.__count || 0);
        }
      }

      return success({
        tags: tags.map((t) => ({
          id: t.id,
          name: t.name,
          opportunityCount: countMap.get(t.id) || 0,
        })),
        totalTags: tags.length,
      });
    } catch (error) {
      return errorToResult(error);
    }
  },
};
