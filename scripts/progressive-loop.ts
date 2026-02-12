#!/usr/bin/env npx tsx
/**
 * Progressive Loop Runner
 * 
 * Usage:
 *   npm run improve              # Full progressive loop (dry run)
 *   npm run improve -- --live    # Full progressive loop (apply changes)
 *   npm run audit                # Audit only (no changes)
 *   npm run baseline             # Save baseline JSON
 *   npm run improve -- --level 3 # Start from L3
 */

// Load .env.local before anything else
import dotenvFlow from 'dotenv-flow'
dotenvFlow.config()

import * as fs from 'fs/promises'
import * as path from 'path'
import { runProgressiveLoop, runAudit } from '../lib/improvement/orchestrator'
import { getToolsForAgent } from '../lib/tools/executor'
import type { LoopConfig } from '../lib/improvement/types'

// Parse CLI args
const args = process.argv.slice(2)
const mode = args.includes('--live') ? 'live' : 'dry'
const auditOnly = args.includes('--audit') || process.argv[1]?.includes('audit')
const baselineOnly = args.includes('--baseline') || process.argv[1]?.includes('baseline')
const startLevel = (() => {
    const idx = args.indexOf('--level')
    return idx >= 0 ? parseInt(args[idx + 1]) || 1 : 1
})()
const maxLevel = (() => {
    const idx = args.indexOf('--max-level')
    return idx >= 0 ? parseInt(args[idx + 1]) || 5 : 5
})()
const categories = (() => {
    const idx = args.indexOf('--categories')
    return idx >= 0 ? args[idx + 1]?.split(',') || ['all'] : ['all']
})()

// Environment check
const requiredEnvVars = ['GEMINI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ Missing env var: ${envVar}`)
        process.exit(1)
    }
}

// Tenant/user config (from env or defaults for testing)
const TENANT_ID = process.env.TEST_TENANT_ID || process.env.IMPROVEMENT_TENANT_ID || 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'
const USER_ID = process.env.TEST_USER_ID || process.env.IMPROVEMENT_USER_ID || 'improvement-loop@tuqui.ai'
const AGENT_SYSTEM_PROMPT = process.env.IMPROVEMENT_AGENT_PROMPT || 'Sos un asistente empresarial inteligente que ayuda con datos de Odoo y MercadoLibre. Respondé en español argentino, profesional pero cercano.'

// Config
const config: Partial<LoopConfig> = {
    dryRun: mode === 'dry',
    startLevel: startLevel as LoopConfig['startLevel'],
    maxLevel: maxLevel as LoopConfig['maxLevel'],
    categories,
    model: process.env.IMPROVEMENT_MODEL || 'gemini-3-flash-preview',
}

// Tool/prompt factories that reload on each call (to pick up changes)
function getSystemPrompt(): string {
    return AGENT_SYSTEM_PROMPT
}

let toolsCache: Record<string, any> | null = null

async function loadTools(): Promise<void> {
    const agentConfig = {
        id: 'improvement-loop',
        tools: ['odoo', 'web_search'] as string[],
        rag_enabled: false,
    }
    toolsCache = await getToolsForAgent(TENANT_ID, agentConfig, USER_ID)
    console.log(`🔧 Loaded ${Object.keys(toolsCache).length} tools`)
}

function getTools(): Record<string, any> {
    if (!toolsCache) throw new Error('Tools not loaded — call loadTools() first')
    return toolsCache
}

async function main() {
    console.log('🚀 Progressive Loop Runner')
    console.log(`   Tenant: ${TENANT_ID}`)
    console.log(`   Mode: ${auditOnly ? 'AUDIT' : baselineOnly ? 'BASELINE' : mode.toUpperCase()}`)
    console.log(`   Levels: L${startLevel} → L${maxLevel}`)
    console.log('')

    // Load tools
    await loadTools()

    // Run
    const runner = auditOnly || baselineOnly ? runAudit : runProgressiveLoop
    const result = await runner(config, getSystemPrompt, getTools)

    // Save baseline
    if (baselineOnly || !auditOnly) {
        const baselineDir = path.join(process.cwd(), 'baselines')
        await fs.mkdir(baselineDir, { recursive: true })
        
        const filename = `${result.date}.json`
        const filepath = path.join(baselineDir, filename)
        await fs.writeFile(filepath, JSON.stringify(result, null, 2))
        console.log(`\n💾 Baseline saved: baselines/${filename}`)
    }
}

main().catch(error => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
})
