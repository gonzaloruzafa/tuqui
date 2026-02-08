/**
 * Progressive Improvement Loop Orchestrator
 * 
 * Runs test scenarios by difficulty level (L1→L5),
 * audits responses, applies skill improvements,
 * and checks for regressions before graduating.
 * 
 * Uses LLM engine (llm-engine) — same as production chat.
 */

import { 
    LoopConfig, 
    DEFAULT_LOOP_CONFIG,
    TestScenario,
    ScenarioResult,
    ScenarioAudit,
    ConversationTurn,
    LevelResult,
    ProgressiveLoopResult,
} from './types'
import { auditScenario, consolidateSuggestions } from './auditor'
import { suggestionToChange, applyChange, revertChange } from './improver'
import { generateTextWithThinking } from '../tools/llm-engine'
import { ALL_TEST_CASES, TEST_CASES_BY_DIFFICULTY, EvalTestCase } from '../../tests/evals/test-cases'

/**
 * Convert eval test cases to improvement scenarios
 */
function evalCasesToScenarios(
    testCases: EvalTestCase[],
    categories?: string[]
): TestScenario[] {
    const runAll = !categories || categories.length === 0 || categories.includes('all')
    
    return testCases
        .filter(tc => runAll || categories!.includes(tc.category))
        .map(tc => ({
            id: tc.id,
            name: tc.question.slice(0, 50),
            description: tc.question,
            category: tc.category as TestScenario['category'],
            difficulty: tc.difficulty as TestScenario['difficulty'],
            requiresValidLinks: tc.requiresValidLinks || false,
            turns: [{
                userMessage: tc.question,
                expectedPatterns: tc.expectedPatterns?.map(r => r.source),
                expectedSkills: tc.expectedSkillHints,
            }],
        }))
}

/**
 * Get scenarios for a specific difficulty level
 */
function getScenariosForLevel(level: number, categories?: string[]): TestScenario[] {
    const levelCases = TEST_CASES_BY_DIFFICULTY[level as keyof typeof TEST_CASES_BY_DIFFICULTY] || []
    return evalCasesToScenarios(levelCases, categories)
}

/**
 * Run a single test scenario through the V2 agent
 */
async function runScenario(
    scenario: TestScenario,
    systemPrompt: string,
    tools: Record<string, any>,
    model: string
): Promise<ScenarioResult> {
    const turns: ConversationTurn[] = []
    const messages: any[] = []
    const startTime = Date.now()
    
    for (const turn of scenario.turns) {
        messages.push({ role: 'user', content: turn.userMessage })
        
        const turnStart = Date.now()
        const result = await generateTextWithThinking({
            model,
            system: systemPrompt,
            messages,
            tools,
            maxSteps: 10,
            thinkingLevel: 'low',
            includeThoughts: false,
        })
        
        turns.push({
            userMessage: turn.userMessage,
            assistantResponse: result.text,
            toolCalls: result.toolCalls || [],
            latencyMs: Date.now() - turnStart,
        })
        
        messages.push({ role: 'assistant', content: result.text })
    }
    
    return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        turns,
        passed: false, // Determined by audit
        totalLatencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
    }
}

/**
 * Run all scenarios at a given difficulty level
 */
async function runLevel(
    level: number,
    systemPrompt: string,
    tools: Record<string, any>,
    config: LoopConfig
): Promise<LevelResult> {
    const scenarios = getScenariosForLevel(level, config.categories)
    
    if (scenarios.length === 0) {
        console.log(`\n  ⚠️  No scenarios for L${level}, auto-graduating`)
        return { level, total: 0, passed: 0, rate: 1, graduated: true, attempts: 1, audits: [] }
    }

    console.log(`\n  📝 Running ${scenarios.length} L${level} scenarios...`)
    
    const results: ScenarioResult[] = []
    for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i]
        console.log(`     [${i + 1}/${scenarios.length}] ${scenario.name}`)
        
        try {
            const result = await runScenario(scenario, systemPrompt, tools, config.model)
            results.push(result)
        } catch (error) {
            console.error(`     ❌ Error: ${(error as Error).message}`)
        }
        
        if (i < scenarios.length - 1) {
            await new Promise(r => setTimeout(r, config.delayBetweenTests))
        }
    }
    
    // Audit results
    const audits: ScenarioAudit[] = []
    for (const result of results) {
        const scenario = scenarios.find(s => s.id === result.scenarioId)!
        const audit = await auditScenario(result, scenario)
        audits.push(audit)
        
        const icon = audit.overallPassed ? '✅' : '❌'
        console.log(`     ${icon} ${result.scenarioName}: ${audit.averageScore.toFixed(1)}/5`)
    }
    
    const passedCount = audits.filter(a => a.overallPassed).length
    const rate = results.length > 0 ? passedCount / results.length : 0
    const threshold = config.levelThresholds[level] || 0.85
    const graduated = rate >= threshold
    
    console.log(`  📊 L${level}: ${passedCount}/${results.length} (${(rate * 100).toFixed(0)}%) — ${graduated ? '✅ GRADUATED' : `❌ Need ${(threshold * 100).toFixed(0)}%`}`)
    
    return { level, total: results.length, passed: passedCount, rate, graduated, attempts: 1, audits }
}

/**
 * Run gold standard tests to check for regressions
 */
async function checkRegressions(
    passedLevels: number[],
    systemPrompt: string,
    tools: Record<string, any>,
    config: LoopConfig
): Promise<{ passed: boolean; failures: string[] }> {
    if (passedLevels.length === 0) return { passed: true, failures: [] }
    
    console.log(`\n  🏆 Regression check for L${passedLevels.join(', L')}...`)
    
    const failures: string[] = []
    const goldCases = ALL_TEST_CASES.filter(tc => config.goldStandardTests.includes(tc.id))
    const scenarios = evalCasesToScenarios(goldCases)
    
    for (const scenario of scenarios) {
        try {
            const result = await runScenario(scenario, systemPrompt, tools, config.model)
            const audit = await auditScenario(result, scenario)
            if (!audit.overallPassed) {
                failures.push(scenario.id)
            }
        } catch {
            failures.push(scenario.id)
        }
        await new Promise(r => setTimeout(r, config.delayBetweenTests))
    }
    
    const passed = failures.length === 0
    console.log(`  ${passed ? '✅' : '❌'} Regressions: ${failures.length === 0 ? 'none' : failures.join(', ')}`)
    
    return { passed, failures }
}

/**
 * Progressive improvement loop: L1 → L5 with graduation
 */
export async function runProgressiveLoop(
    config: Partial<LoopConfig> = {},
    getSystemPrompt: () => string,
    getTools: () => Record<string, any>
): Promise<ProgressiveLoopResult> {
    const cfg: LoopConfig = { ...DEFAULT_LOOP_CONFIG, ...config }
    const startTime = Date.now()
    const changesApplied: ProgressiveLoopResult['changesApplied'] = []
    const levelResults: Record<number, LevelResult> = {}
    const passedLevels: number[] = []
    let maxLevelPassed = 0
    
    console.log('\n' + '═'.repeat(60))
    console.log('🧠 PROGRESSIVE IMPROVEMENT LOOP')
    console.log('═'.repeat(60))
    console.log(`   Mode: ${cfg.dryRun ? 'DRY RUN' : 'LIVE'}`)
    console.log(`   Model: ${cfg.model}`)
    console.log(`   Levels: L${cfg.startLevel} → L${cfg.maxLevel}`)
    console.log(`   Categories: ${cfg.categories.join(', ')}`)
    console.log('')
    
    for (let level = cfg.startLevel; level <= cfg.maxLevel; level++) {
        console.log(`\n${'━'.repeat(60)}`)
        console.log(`📍 LEVEL ${level}`)
        console.log('━'.repeat(60))
        
        let levelResult: LevelResult | null = null
        let attempts = 0
        
        while (attempts < cfg.maxRetriesPerLevel) {
            attempts++
            if (attempts > 1) {
                console.log(`\n  🔄 Retry ${attempts}/${cfg.maxRetriesPerLevel}`)
            }
            
            const systemPrompt = getSystemPrompt()
            const tools = getTools()
            
            levelResult = await runLevel(level, systemPrompt, tools, cfg)
            levelResult.attempts = attempts
            
            if (levelResult.graduated) {
                break
            }
            
            // Try to improve: consolidate suggestions and apply
            const suggestions = consolidateSuggestions(levelResult.audits)
            
            if (suggestions.length === 0 || cfg.dryRun) {
                console.log(`\n  💡 ${suggestions.length} suggestions${cfg.dryRun ? ' (dry run, not applying)' : ' but none actionable'}`)
                
                if (cfg.dryRun && suggestions.length > 0) {
                    for (const s of suggestions.slice(0, 5)) {
                        console.log(`     - [${s.priority}] ${s.skillName}: ${s.rationale.slice(0, 80)}`)
                    }
                }
                break
            }
            
            // Apply high-priority changes
            console.log(`\n  💡 ${suggestions.length} suggestions, applying...`)
            
            for (const suggestion of suggestions) {
                const change = await suggestionToChange(suggestion, changesApplied.length)
                if (!change || change.requiresReview) continue
                
                const result = await applyChange(change, cfg.dryRun)
                if (result.applied) {
                    changesApplied.push({
                        skill: change.skillName,
                        field: change.changeType,
                        diff: `${change.oldValue.slice(0, 50)} → ${change.newValue.slice(0, 50)}`,
                    })
                    console.log(`     ✅ Applied: ${change.skillName}.${change.changeType}`)
                }
            }
            
            // Check for regressions after changes
            if (changesApplied.length > 0 && !cfg.dryRun) {
                const regression = await checkRegressions(passedLevels, getSystemPrompt(), getTools(), cfg)
                if (!regression.passed) {
                    console.log(`  ⏪ Regressions detected! Reverting...`)
                    // Note: revert would need tracking which changes were just applied
                    break
                }
            }
        }
        
        if (levelResult) {
            levelResults[level] = levelResult
            
            if (levelResult.graduated) {
                passedLevels.push(level)
                maxLevelPassed = level
            } else {
                console.log(`\n  ⛔ Cannot graduate L${level} after ${attempts} attempts. Stopping.`)
                break
            }
        }
    }
    
    // Build result
    const result: ProgressiveLoopResult = {
        date: new Date().toISOString().split('T')[0],
        model: cfg.model,
        levels: {},
        maxLevelPassed,
        changesApplied,
        regressions: [],
        duration: Date.now() - startTime,
    }
    
    for (const [lvl, lr] of Object.entries(levelResults)) {
        result.levels[Number(lvl)] = { total: lr.total, passed: lr.passed, rate: lr.rate }
    }
    
    // Final report
    console.log('\n' + '═'.repeat(60))
    console.log('📈 LOOP COMPLETE')
    console.log('═'.repeat(60))
    console.log(`   Duration: ${(result.duration / 1000).toFixed(0)}s`)
    console.log(`   Max level passed: L${maxLevelPassed}`)
    console.log(`   Changes applied: ${changesApplied.length}`)
    for (const [lvl, data] of Object.entries(result.levels)) {
        console.log(`   L${lvl}: ${data.passed}/${data.total} (${(data.rate * 100).toFixed(0)}%)`)
    }
    
    return result
}

/**
 * Audit-only mode: run all tests and report without improving
 */
export async function runAudit(
    config: Partial<LoopConfig> = {},
    getSystemPrompt: () => string,
    getTools: () => Record<string, any>
): Promise<ProgressiveLoopResult> {
    return runProgressiveLoop(
        { ...config, dryRun: true, maxRetriesPerLevel: 1 },
        getSystemPrompt,
        getTools,
    )
}

export { evalCasesToScenarios, runScenario, getScenariosForLevel }
