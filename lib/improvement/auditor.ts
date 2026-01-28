/**
 * Response Auditor
 * Uses LLM to evaluate response quality and suggest improvements
 */

import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { 
    ConversationTurn, 
    AuditResult, 
    AuditIssue, 
    ImprovementSuggestion,
    ScenarioAudit,
    ScenarioResult 
} from './types'
import { MLLinkValidator } from '@/lib/skills/web-search/mercadolibre'

const AuditResultSchema = z.object({
    relevanceScore: z.number().min(1).max(5).describe('1-5: ¿La respuesta es relevante a la pregunta?'),
    accuracyScore: z.number().min(1).max(5).describe('1-5: ¿Los datos son correctos y verificables?'),
    completenessScore: z.number().min(1).max(5).describe('1-5: ¿La respuesta está completa?'),
    toneScore: z.number().min(1).max(5).describe('1-5: ¿El tono es apropiado (español argentino, profesional)?'),
    
    issues: z.array(z.object({
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        category: z.enum(['wrong_tool', 'missing_data', 'hallucination', 'tone', 'incomplete', 'wrong_params', 'unnecessary_question']),
        description: z.string(),
        evidence: z.string()
    })),
    
    suggestions: z.array(z.object({
        skillName: z.string(),
        changeType: z.enum(['description', 'parameters', 'defaults', 'new_skill', 'system_prompt']),
        priority: z.enum(['low', 'medium', 'high']),
        currentValue: z.string().optional(),
        suggestedValue: z.string(),
        rationale: z.string()
    }))
})

/**
 * Extrae URLs de un texto y las valida
 */
function extractURLsFromText(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s\)\]]+/g
    return text.match(urlRegex) || []
}

/**
 * Valida links de MercadoLibre en una respuesta
 * Retorna info sobre links válidos/inválidos y chequeo HTTP
 */
export async function validateMeliLinks(
    responseText: string,
    checkHTTP: boolean = true
): Promise<{
    totalLinks: number
    validProductLinks: number
    invalidLinks: string[]
    httpValidated: number
    httpFailed: string[]
    allValid: boolean
}> {
    const urls = extractURLsFromText(responseText)
    const meliUrls = urls.filter(url => MLLinkValidator.isMercadoLibreDomain(url))
    
    if (meliUrls.length === 0) {
        return {
            totalLinks: 0,
            validProductLinks: 0,
            invalidLinks: [],
            httpValidated: 0,
            httpFailed: [],
            allValid: true // No links = no problem
        }
    }
    
    // Validate with HTTP check enabled
    const validation = await MLLinkValidator.validateLinks(meliUrls, checkHTTP)
    
    const httpFailed = validation.invalid
        .filter(r => r.isProduct && !r.httpOk)
        .map(r => r.url)
    
    return {
        totalLinks: meliUrls.length,
        validProductLinks: validation.validCount,
        invalidLinks: validation.invalid.map(r => r.url),
        httpValidated: validation.valid.filter(r => r.httpOk).length,
        httpFailed,
        allValid: validation.validCount === meliUrls.length && httpFailed.length === 0
    }
}

/**
 * Audit a single conversation turn
 */
export async function auditTurn(
    turn: ConversationTurn,
    turnIndex: number,
    scenarioContext: string,
    expectedPatterns?: string[],
    expectedSkills?: string[],
    requiresValidLinks?: boolean
): Promise<AuditResult> {
    const toolsUsed = turn.toolCalls.map(tc => tc.toolName)
    
    const prompt = `Sos un auditor de calidad para un chatbot empresarial de Odoo/MercadoLibre.

CONTEXTO DEL ESCENARIO:
${scenarioContext}

TURNO #${turnIndex + 1}:
Usuario: "${turn.userMessage}"
Asistente: "${turn.assistantResponse}"

HERRAMIENTAS USADAS: ${toolsUsed.length > 0 ? toolsUsed.join(', ') : 'ninguna'}
${expectedSkills?.length ? `HERRAMIENTAS ESPERADAS: ${expectedSkills.join(', ')}` : ''}
${expectedPatterns?.length ? `PATRONES ESPERADOS EN RESPUESTA: ${expectedPatterns.join(', ')}` : ''}

DATOS DE HERRAMIENTAS:
${turn.toolCalls.map(tc => `- ${tc.toolName}(${JSON.stringify(tc.args)}): ${tc.error ? 'ERROR: ' + tc.error : JSON.stringify(tc.result).slice(0, 500)}`).join('\n')}

EVALÚA LA RESPUESTA:
1. ¿Usó las herramientas correctas?
2. ¿Los parámetros fueron correctos (fechas, filtros, etc)?
3. ¿La respuesta incluye los datos esperados?
4. ¿El tono es apropiado (español argentino, profesional pero cercano)?
5. ¿Hay alucinaciones o datos inventados?
6. ¿Preguntó innecesariamente cuando debía usar defaults?

IMPORTANTE: 
- Sé CONCISO en descriptions y evidence (máximo 100 palabras cada uno)
- Máximo 3 issues y 3 suggestions
- Sugerí mejoras ESPECÍFICAS y ACCIONABLES para las skills`

    try {
        const { object } = await generateObject({
            model: google('gemini-2.0-flash'),
            schema: AuditResultSchema,
            prompt
        })
        
        let overallScore = (object.relevanceScore + object.accuracyScore + object.completenessScore + object.toneScore) / 4
        const issues = [...object.issues] as AuditIssue[]
        
        // Si requiere validación de links, validar formato (no HTTP porque MeLi bloquea bots)
        if (requiresValidLinks) {
            console.log('[Auditor] Validating MercadoLibre links (format only, no HTTP)...')
            // checkHTTP=false porque MercadoLibre bloquea requests desde Node.js
            const linkValidation = await validateMeliLinks(turn.assistantResponse, false)
            
            if (linkValidation.totalLinks > 0) {
                console.log(`[Auditor] Links: ${linkValidation.validProductLinks}/${linkValidation.totalLinks} valid product URLs`)
                
                // Calcular % de links inválidos (listados en vez de productos)
                const invalidListingUrls = linkValidation.invalidLinks.filter(url => 
                    url.includes('listado.') || url.includes('/s/') || url.includes('/ofertas')
                )
                
                if (invalidListingUrls.length > 0) {
                    const penalty = Math.min(1.5, invalidListingUrls.length * 0.5)
                    overallScore = Math.max(1, overallScore - penalty)
                    issues.push({
                        severity: 'high',
                        category: 'hallucination',
                        description: `${invalidListingUrls.length} links son de listados/búsqueda, no de productos`,
                        evidence: invalidListingUrls.slice(0, 2).join(', ')
                    })
                }
                
                // Si hay links pero ninguno válido como producto
                if (linkValidation.validProductLinks === 0) {
                    overallScore = Math.max(1, overallScore - 1.0)
                    issues.push({
                        severity: 'medium',
                        category: 'incomplete',
                        description: 'Ningún link apunta a un producto de MercadoLibre (deberían ser /articulo/MLA-XXXXX)',
                        evidence: `${linkValidation.totalLinks} links encontrados pero 0 válidos`
                    })
                }
            } else {
                // Si requiere links pero no hay ninguno, penalizar
                overallScore = Math.max(1, overallScore - 1.0)
                issues.push({
                    severity: 'medium',
                    category: 'incomplete',
                    description: 'La respuesta debería incluir links de MercadoLibre pero no tiene ninguno',
                    evidence: 'No se encontraron URLs en la respuesta'
                })
            }
        }
        
        return {
            turnIndex,
            userMessage: turn.userMessage,
            assistantResponse: turn.assistantResponse,
            toolsUsed,
            relevanceScore: object.relevanceScore,
            accuracyScore: object.accuracyScore,
            completenessScore: object.completenessScore,
            toneScore: object.toneScore,
            overallScore,
            passed: overallScore >= 4.0 && !issues.some(i => i.severity === 'critical'),
            issues,
            suggestions: object.suggestions as ImprovementSuggestion[]
        }
    } catch (error) {
        console.error('[Auditor] Failed to audit turn:', error)
        return {
            turnIndex,
            userMessage: turn.userMessage,
            assistantResponse: turn.assistantResponse,
            toolsUsed,
            relevanceScore: 0,
            accuracyScore: 0,
            completenessScore: 0,
            toneScore: 0,
            overallScore: 0,
            passed: false,
            issues: [{
                severity: 'critical',
                category: 'incomplete',
                description: 'Audit failed',
                evidence: String(error)
            }],
            suggestions: []
        }
    }
}

/**
 * Audit a complete scenario
 */
export async function auditScenario(
    result: ScenarioResult,
    scenario: { 
        description: string
        requiresValidLinks?: boolean
        turns: { expectedPatterns?: string[], expectedSkills?: string[] }[]
    }
): Promise<ScenarioAudit> {
    const turnAudits: AuditResult[] = []
    
    for (let i = 0; i < result.turns.length; i++) {
        const turn = result.turns[i]
        const expectedTurn = scenario.turns[i]
        
        // Add delay to avoid rate limits
        if (i > 0) await new Promise(r => setTimeout(r, 500))
        
        const audit = await auditTurn(
            turn,
            i,
            scenario.description,
            expectedTurn?.expectedPatterns,
            expectedTurn?.expectedSkills,
            scenario.requiresValidLinks  // Pass for MeLi link validation
        )
        turnAudits.push(audit)
    }
    
    // Aggregate results
    const criticalIssues = turnAudits.flatMap(a => a.issues.filter(i => i.severity === 'critical' || i.severity === 'high'))
    const allSuggestions = turnAudits.flatMap(a => a.suggestions)
    
    // Deduplicate suggestions by skill+changeType
    const suggestionMap = new Map<string, ImprovementSuggestion>()
    for (const s of allSuggestions) {
        const key = `${s.skillName}:${s.changeType}`
        if (!suggestionMap.has(key) || s.priority === 'high') {
            suggestionMap.set(key, s)
        }
    }
    
    const averageScore = turnAudits.reduce((sum, a) => sum + a.overallScore, 0) / turnAudits.length
    
    return {
        scenarioId: result.scenarioId,
        scenarioName: result.scenarioName,
        category: 'odoo', // TODO: get from scenario
        turnAudits,
        overallPassed: turnAudits.every(a => a.passed),
        averageScore,
        criticalIssues,
        aggregatedSuggestions: Array.from(suggestionMap.values())
    }
}

/**
 * Consolidate suggestions across multiple scenario audits
 */
export function consolidateSuggestions(audits: ScenarioAudit[]): ImprovementSuggestion[] {
    const suggestionCounts = new Map<string, { suggestion: ImprovementSuggestion, count: number }>()
    
    for (const audit of audits) {
        for (const s of audit.aggregatedSuggestions) {
            const key = `${s.skillName}:${s.changeType}:${s.suggestedValue.slice(0, 50)}`
            const existing = suggestionCounts.get(key)
            if (existing) {
                existing.count++
                // Upgrade priority if seen multiple times
                if (existing.count >= 3 && existing.suggestion.priority !== 'high') {
                    existing.suggestion.priority = 'high'
                }
            } else {
                suggestionCounts.set(key, { suggestion: s, count: 1 })
            }
        }
    }
    
    // Sort by priority and count
    return Array.from(suggestionCounts.values())
        .sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 }
            const priorityDiff = priorityOrder[a.suggestion.priority] - priorityOrder[b.suggestion.priority]
            if (priorityDiff !== 0) return priorityDiff
            return b.count - a.count
        })
        .map(x => x.suggestion)
}
