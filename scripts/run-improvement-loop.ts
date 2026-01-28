#!/usr/bin/env npx tsx
/**
 * Run Improvement Loop
 * 
 * Usage:
 *   npx tsx scripts/run-improvement-loop.ts --dry-run --categories odoo
 *   npx tsx scripts/run-improvement-loop.ts --apply --interactive
 */

// Load environment variables
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { runImprovementLoop, LoopConfig } from '../lib/improvement'
import { TUQUI_UNIFIED } from '../lib/agents/unified'
import { odooSkills } from '../lib/skills/odoo'
import { webSearchTool } from '../lib/tools/web-search'
import { Skill, SkillContext, OdooCredentials } from '../lib/skills/types'

// Default tenant for testing (Adhoc)
const DEFAULT_TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2'

/**
 * Load Odoo credentials from Supabase integrations table
 */
async function loadOdooCredentials(tenantId: string): Promise<OdooCredentials | undefined> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials')
        return undefined
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data: integration, error } = await supabase
        .from('integrations')
        .select('config, is_active')
        .eq('tenant_id', tenantId)
        .eq('type', 'odoo')
        .eq('is_active', true)
        .single()
    
    if (error || !integration) {
        console.error(`❌ No Odoo integration for tenant ${tenantId}:`, error?.message)
        return undefined
    }
    
    const cfg = integration.config as Record<string, string>
    
    return {
        url: cfg.odoo_url || cfg.url,
        db: cfg.odoo_db || cfg.db,
        username: cfg.odoo_user || cfg.username,
        apiKey: cfg.odoo_password || cfg.api_key
    }
}

// Parse command line arguments
function parseArgs(): Partial<LoopConfig> {
    const args = process.argv.slice(2)
    const config: Partial<LoopConfig> = {}
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        
        if (arg === '--dry-run') {
            config.dryRun = true
        } else if (arg === '--apply') {
            config.dryRun = false
        } else if (arg === '--interactive') {
            config.interactive = true
        } else if (arg === '--categories' && args[i + 1]) {
            config.categories = args[++i].split(',') as any
        } else if (arg === '--max-iterations' && args[i + 1]) {
            config.maxIterations = parseInt(args[++i], 10)
        } else if (arg === '--min-pass-rate' && args[i + 1]) {
            config.minPassRate = parseFloat(args[++i])
        } else if (arg === '--delay' && args[i + 1]) {
            config.delayBetweenTests = parseInt(args[++i], 10)
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Tuqui Improvement Loop
======================

Run automated improvement cycles on Tuqui's skills.

Usage:
  npx tsx scripts/run-improvement-loop.ts [options]

Options:
  --dry-run           Run without applying changes (default)
  --apply             Apply changes to skill files
  --interactive       Pause after each iteration for review
  --categories <list> Comma-separated categories (ventas,stock,cobranzas,mercadolibre,edge-cases,all)
  --max-iterations N  Maximum improvement iterations (default: 5)
  --min-pass-rate N   Target pass rate 0-1 (default: 0.85)
  --delay N           Delay between tests in ms (default: 1500)
  --help, -h          Show this help message

Examples:
  # Dry run on Odoo skills only
  npx tsx scripts/run-improvement-loop.ts --dry-run --categories odoo

  # Apply changes with review
  npx tsx scripts/run-improvement-loop.ts --apply --interactive

  # Run until 90% pass rate
  npx tsx scripts/run-improvement-loop.ts --dry-run --min-pass-rate 0.9
`)
            process.exit(0)
        }
    }
    
    // Default to dry run if not specified
    if (config.dryRun === undefined) {
        config.dryRun = true
    }
    
    return config
}

/**
 * Convert skills to AI SDK tool format with real Odoo credentials
 */
function skillsToTools(skills: Skill<any, any>[], context: SkillContext): Record<string, any> {
    const tools: Record<string, any> = {}
    
    for (const skill of skills) {
        tools[skill.name] = {
            description: skill.description,
            parameters: skill.inputSchema,
            execute: async (args: any) => {
                try {
                    return await skill.execute(args, context)
                } catch (error: any) {
                    return { error: error.message }
                }
            }
        }
    }
    
    return tools
}

async function main() {
    const config = parseArgs()
    const tenantId = DEFAULT_TENANT_ID
    
    console.log('\n🚀 Tuqui Improvement Loop')
    console.log('========================\n')
    
    if (config.dryRun) {
        console.log('⚠️  Running in DRY RUN mode - no files will be modified')
    } else {
        console.log('⚡ Running in APPLY mode - files will be modified!')
    }
    
    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
        console.error('\n❌ GEMINI_API_KEY not set')
        console.log('   Run: export GEMINI_API_KEY=your-key')
        process.exit(1)
    }
    
    // Load real Odoo credentials from Supabase
    console.log(`\n🔐 Loading Odoo credentials for tenant ${tenantId}...`)
    const odooCredentials = await loadOdooCredentials(tenantId)
    
    if (!odooCredentials) {
        console.error('\n❌ Could not load Odoo credentials. Check integrations table.')
        process.exit(1)
    }
    
    console.log(`✅ Odoo URL: ${odooCredentials.url}`)
    console.log(`✅ Odoo DB: ${odooCredentials.db}`)
    console.log(`✅ Odoo User: ${odooCredentials.username}`)
    
    // Create skill context with real credentials
    const skillContext: SkillContext = {
        tenantId,
        userId: 'improvement-loop',
        credentials: {
            odoo: odooCredentials
        }
    }
    
    // Check if MercadoLibre tests are included
    const includesMeli = !config.categories || 
                         config.categories.length === 0 || 
                         config.categories.includes('mercadolibre') ||
                         config.categories.includes('all')
    
    if (includesMeli) {
        console.log('🛒 MercadoLibre tests enabled - web_search tool will be available')
        
        // Verify Serper API key for MeLi tests
        if (!process.env.SERPER_API_KEY) {
            console.warn('⚠️  SERPER_API_KEY not set - MeLi tests may fail')
        }
    }
    
    try {
        const summaries = await runImprovementLoop(
            config,
            () => TUQUI_UNIFIED.systemPrompt,
            () => {
                // Start with Odoo skills
                const tools = skillsToTools(odooSkills as any, skillContext)
                
                // Add web_search tool for MeLi/general searches
                if (includesMeli) {
                    tools['web_search'] = webSearchTool
                }
                
                return tools
            }
        )
        
        // Write summary to file
        const summaryPath = `./improvement-summary-${Date.now()}.json`
        const fs = await import('fs/promises')
        await fs.writeFile(summaryPath, JSON.stringify(summaries, null, 2))
        console.log(`\n📄 Summary written to: ${summaryPath}`)
        
    } catch (error) {
        console.error('\n❌ Improvement loop failed:', error)
        process.exit(1)
    }
}

main()
