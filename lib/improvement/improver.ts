/**
 * Skill Improver
 * Applies suggested changes to skill files
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { ImprovementSuggestion, ProposedChange, ChangeResult } from './types'

const SKILLS_DIR = path.join(process.cwd(), 'lib/skills')
const AGENTS_DIR = path.join(process.cwd(), 'lib/agents')

/**
 * Map common alias names to actual skill files
 */
const SKILL_ALIASES: Record<string, string> = {
    'web_search': 'hybrid',
    'MercadoLibre Search': 'hybrid',
    'mercadolibre': 'hybrid',
    'meli_search': 'search',
    'meli_analyze': 'analyze',
    'meli_compare': 'compare',
    'comparar_precios': 'compare',
    'Resumen de precios': 'hybrid',
}

/**
 * Find the file path for a given skill
 */
async function findSkillFile(skillName: string): Promise<string | null> {
    // Check for known aliases first
    const resolvedName = SKILL_ALIASES[skillName] || skillName
    
    // Check odoo skills
    const odooPath = path.join(SKILLS_DIR, 'odoo', `${resolvedName}.ts`)
    try {
        await fs.access(odooPath)
        return odooPath
    } catch {}
    
    // Check MercadoLibre skills (web-search/mercadolibre/)
    const meliPath = path.join(SKILLS_DIR, 'web-search', 'mercadolibre', `${resolvedName}.ts`)
    try {
        await fs.access(meliPath)
        return meliPath
    } catch {}
    
    // Check legacy meli path
    const legacyMeliPath = path.join(SKILLS_DIR, 'meli', `${resolvedName}.ts`)
    try {
        await fs.access(legacyMeliPath)
        return legacyMeliPath
    } catch {}
    
    // Check for skill with different naming in odoo
    const odooFiles = await fs.readdir(path.join(SKILLS_DIR, 'odoo'))
    for (const file of odooFiles) {
        if (file.endsWith('.ts')) {
            const content = await fs.readFile(path.join(SKILLS_DIR, 'odoo', file), 'utf-8')
            if (content.includes(`name: '${skillName}'`) || content.includes(`name: "${skillName}"`)) {
                return path.join(SKILLS_DIR, 'odoo', file)
            }
        }
    }
    
    // Check for skill with different naming in mercadolibre
    const meliDir = path.join(SKILLS_DIR, 'web-search', 'mercadolibre')
    try {
        const meliFiles = await fs.readdir(meliDir)
        for (const file of meliFiles) {
            if (file.endsWith('.ts') && !file.startsWith('_')) {
                const content = await fs.readFile(path.join(meliDir, file), 'utf-8')
                if (content.includes(`name: '${skillName}'`) || content.includes(`name: "${skillName}"`)) {
                    return path.join(meliDir, file)
                }
            }
        }
    } catch {}
    
    return null
}

/**
 * Convert a suggestion to a proposed change
 */
export async function suggestionToChange(
    suggestion: ImprovementSuggestion,
    index: number
): Promise<ProposedChange | null> {
    if (suggestion.changeType === 'system_prompt') {
        const filePath = path.join(AGENTS_DIR, 'unified.ts')
        try {
            const content = await fs.readFile(filePath, 'utf-8')
            return {
                id: `change-${index}`,
                skillName: 'system_prompt',
                filePath,
                changeType: 'system_prompt',
                oldValue: suggestion.currentValue || '',
                newValue: suggestion.suggestedValue,
                rationale: suggestion.rationale,
                priority: suggestion.priority,
                riskLevel: 'risky', // System prompt changes are always risky
                affectedTests: [], // Would need to determine
                requiresReview: true
            }
        } catch {
            return null
        }
    }
    
    const filePath = await findSkillFile(suggestion.skillName)
    if (!filePath) {
        console.warn(`[Improver] Could not find skill file for: ${suggestion.skillName}`)
        return null
    }
    
    try {
        const content = await fs.readFile(filePath, 'utf-8')
        
        // Determine risk level
        let riskLevel: 'safe' | 'medium' | 'risky' = 'safe'
        if (suggestion.changeType === 'parameters') {
            riskLevel = 'risky' // Schema changes can break things
        } else if (suggestion.changeType === 'defaults') {
            riskLevel = 'medium'
        }
        
        // Filter out new_skill suggestions for now (not supported)
        if (suggestion.changeType === 'new_skill') {
            console.warn(`[Improver] new_skill change type not yet supported`)
            return null
        }
        
        return {
            id: `change-${index}`,
            skillName: suggestion.skillName,
            filePath,
            changeType: suggestion.changeType as 'description' | 'parameters' | 'defaults',
            oldValue: suggestion.currentValue || extractCurrentValue(content, suggestion.changeType),
            newValue: suggestion.suggestedValue,
            rationale: suggestion.rationale,
            priority: suggestion.priority,
            riskLevel,
            affectedTests: [], // Would need to analyze
            requiresReview: riskLevel === 'risky'
        }
    } catch (error) {
        console.error(`[Improver] Error processing skill ${suggestion.skillName}:`, error)
        return null
    }
}

/**
 * Extract current value from skill file
 */
function extractCurrentValue(content: string, changeType: string): string {
    if (changeType === 'description') {
        const match = content.match(/description:\s*['"`]([\s\S]*?)['"`]/m)
        return match?.[1] || ''
    }
    return ''
}

/**
 * Apply a description change to a skill file
 */
async function applyDescriptionChange(change: ProposedChange): Promise<void> {
    const content = await fs.readFile(change.filePath, 'utf-8')
    
    // Find and replace description
    const descriptionRegex = /(description:\s*)(['"`])([\s\S]*?)(\2)/m
    const match = content.match(descriptionRegex)
    
    if (!match) {
        throw new Error(`Could not find description in ${change.filePath}`)
    }
    
    const quote = match[2]
    const newContent = content.replace(
        descriptionRegex,
        `$1${quote}${change.newValue}${quote}`
    )
    
    await fs.writeFile(change.filePath, newContent, 'utf-8')
}

/**
 * Apply a proposed change (dry run or real)
 */
export async function applyChange(
    change: ProposedChange,
    dryRun: boolean = true
): Promise<ChangeResult> {
    console.log(`[Improver] ${dryRun ? '[DRY RUN] ' : ''}Applying change to ${change.skillName}`)
    console.log(`  Type: ${change.changeType}`)
    console.log(`  Old: ${change.oldValue.slice(0, 100)}...`)
    console.log(`  New: ${change.newValue.slice(0, 100)}...`)
    
    if (dryRun) {
        return {
            changeId: change.id,
            applied: false,
            testsRun: 0,
            testsPassed: 0,
            revertRequired: false
        }
    }
    
    try {
        // Create backup
        const content = await fs.readFile(change.filePath, 'utf-8')
        const backupPath = `${change.filePath}.backup`
        await fs.writeFile(backupPath, content, 'utf-8')
        
        // Apply change based on type
        if (change.changeType === 'description') {
            await applyDescriptionChange(change)
        } else {
            throw new Error(`Change type ${change.changeType} not yet implemented`)
        }
        
        return {
            changeId: change.id,
            applied: true,
            testsRun: 0, // TODO: run affected tests
            testsPassed: 0,
            revertRequired: false
        }
    } catch (error: any) {
        console.error(`[Improver] Failed to apply change:`, error)
        return {
            changeId: change.id,
            applied: false,
            error: error.message,
            testsRun: 0,
            testsPassed: 0,
            revertRequired: false
        }
    }
}

/**
 * Revert a change using backup
 */
export async function revertChange(change: ProposedChange): Promise<boolean> {
    const backupPath = `${change.filePath}.backup`
    try {
        const backup = await fs.readFile(backupPath, 'utf-8')
        await fs.writeFile(change.filePath, backup, 'utf-8')
        await fs.unlink(backupPath)
        console.log(`[Improver] Reverted change to ${change.skillName}`)
        return true
    } catch (error) {
        console.error(`[Improver] Failed to revert change:`, error)
        return false
    }
}

/**
 * Clean up backup files
 */
export async function cleanupBackups(changes: ProposedChange[]): Promise<void> {
    for (const change of changes) {
        const backupPath = `${change.filePath}.backup`
        try {
            await fs.unlink(backupPath)
        } catch {
            // Backup doesn't exist, ignore
        }
    }
}

/**
 * Generate a summary of proposed changes for PR
 */
export function generateChangeSummary(changes: ProposedChange[]): string {
    const lines = [
        '# Proposed Skill Improvements',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Changes',
        ''
    ]
    
    for (const change of changes) {
        lines.push(`### ${change.skillName} (${change.changeType})`)
        lines.push('')
        lines.push(`**Priority:** ${change.priority}`)
        lines.push(`**Risk Level:** ${change.riskLevel}`)
        lines.push('')
        lines.push('**Rationale:**')
        lines.push(change.rationale)
        lines.push('')
        lines.push('**Before:**')
        lines.push('```')
        lines.push(change.oldValue)
        lines.push('```')
        lines.push('')
        lines.push('**After:**')
        lines.push('```')
        lines.push(change.newValue)
        lines.push('```')
        lines.push('')
        lines.push('---')
        lines.push('')
    }
    
    return lines.join('\n')
}
