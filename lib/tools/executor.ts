import { getOdooClient } from './odoo/client'
import { meliTools } from './mercadolibre/tools'
import { tavilySearchTool } from './tavily'
import { tool } from 'ai'
import { z } from 'zod'

export async function getToolsForAgent(tenantId: string, agentTools: string[]) {
    const tools: Record<string, any> = {}

    // 1. Tavily Web Search
    if (agentTools.includes('web_search') || agentTools.includes('tavily')) {
        tools.web_search = tavilySearchTool
    }

    // 2. Odoo Tools
    if (agentTools.some(t => t.startsWith('odoo_'))) {
        try {
            const odoo = await getOdooClient(tenantId)

            if (agentTools.includes('odoo_search')) {
                tools.odoo_search = tool({
                    description: 'Buscar registros en Odoo (ventas, contactos, productos, etc)',
                    parameters: z.object({
                        model: z.string().describe('Modelo de Odoo (sale.order, res.partner, product.template)'),
                        domain: z.array(z.array(z.any())).describe('Dominio de búsqueda RPN. Ej: [["name", "ilike", "juan"]]'),
                        fields: z.array(z.string()).optional().describe('Campos a retornar'),
                        limit: z.number().optional().default(5)
                    }),
                    execute: async ({ model, domain, fields, limit }) => {
                        return await odoo.searchRead(model, domain, fields, limit)
                    }
                })
            }

            if (agentTools.includes('odoo_analyze')) {
                // Placeholder for analysis tool
                // In real app could use read_group
            }
        } catch (e) {
            console.warn('Failed to load Odoo tools:', e)
        }
    }

    // 2. MercadoLibre Tools
    if (agentTools.some(t => t.startsWith('meli_'))) {
        if (agentTools.includes('meli_search')) {
            tools.meli_search = meliTools.meli_search
        }
        if (agentTools.includes('meli_price_analysis')) {
            tools.meli_price_analysis = meliTools.meli_price_analysis
        }
    }

    return tools
}
