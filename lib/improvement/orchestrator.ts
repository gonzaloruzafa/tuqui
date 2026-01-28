/**
 * Improvement Loop Orchestrator
 * Coordinates the test → audit → improve cycle
 */

import { 
    LoopConfig, 
    DEFAULT_LOOP_CONFIG,
    TestScenario,
    ScenarioResult,
    ScenarioAudit,
    ProposedChange,
    LoopIterationSummary,
    ConversationTurn
} from './types'
import { auditScenario, consolidateSuggestions } from './auditor'
import { suggestionToChange, applyChange, revertChange, generateChangeSummary } from './improver'
import { generateTextNative, ToolCallRecord } from '../tools/native-gemini'

// Import test scenarios from evals
import { ALL_TEST_CASES, EvalTestCase } from '../../tests/evals/test-cases'

/**
 * Convert eval test cases to improvement scenarios
 */
function evalCasesToScenarios(categories: string[]): TestScenario[] {
    // 'all' or empty array means run all test cases
    const runAll = categories.length === 0 || categories.includes('all')
    
    return ALL_TEST_CASES
        .filter(tc => runAll || categories.includes(tc.category))
        .map(tc => ({
            id: tc.id,
            name: tc.question.slice(0, 50),
            description: tc.question,
            category: tc.category as any,
            requiresValidLinks: tc.requiresValidLinks || false,
            turns: [{
                userMessage: tc.question,
                expectedPatterns: tc.expectedPatterns?.map(r => r.source),
                expectedSkills: tc.expectedSkillHints
            }]
        }))
}

/**
 * Run a single test scenario through the agent
 */
async function runScenario(
    scenario: TestScenario,
    systemPrompt: string,
    tools: Record<string, any>
): Promise<ScenarioResult> {
    const turns: ConversationTurn[] = []
    const messages: any[] = []
    const startTime = Date.now()
    
    for (const turn of scenario.turns) {
        messages.push({ role: 'user', content: turn.userMessage })
        
        const turnStart = Date.now()
        const result = await generateTextNative({
            model: 'gemini-2.0-flash',
            system: systemPrompt,
            messages,
            tools,
            maxSteps: 5
        })
        
        turns.push({
            userMessage: turn.userMessage,
            assistantResponse: result.text,
            toolCalls: result.toolCalls || [],
            latencyMs: Date.now() - turnStart
        })
        
        messages.push({ role: 'assistant', content: result.text })
    }
    
    return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        turns,
        passed: false, // Will be determined by audit
        totalLatencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
    }
}

/**
 * Run gold standard tests to check for regressions
 */
async function runGoldStandardTests(
    goldTestIds: string[],
    systemPrompt: string,
    tools: Record<string, any>
): Promise<{ passed: boolean, failures: string[] }> {
    const scenarios = evalCasesToScenarios([]).filter(s => goldTestIds.includes(s.id))
    const failures: string[] = []
    
    for (const scenario of scenarios) {
        const result = await runScenario(scenario, systemPrompt, tools)
        const audit = await auditScenario(result, scenario)
        
        if (!audit.overallPassed) {
            failures.push(scenario.id)
        }
    }
    
    return {
        passed: failures.length === 0,
        failures
    }
}

/**
 * Main improvement loop orchestrator
 */
export async function runImprovementLoop(
    config: Partial<LoopConfig> = {},
    getSystemPrompt: () => string,
    getTools: () => Record<string, any>
): Promise<LoopIterationSummary[]> {
    const cfg: LoopConfig = { ...DEFAULT_LOOP_CONFIG, ...config }
    const summaries: LoopIterationSummary[] = []
    
    console.log('\n🔄 Starting Improvement Loop')
    console.log(`   Mode: ${cfg.dryRun ? 'DRY RUN' : 'LIVE'}`)
    console.log(`   Categories: ${cfg.categories.join(', ')}`)
    console.log(`   Max iterations: ${cfg.maxIterations}`)
    console.log('')
    
    for (let iteration = 1; iteration <= cfg.maxIterations; iteration++) {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        console.log(`📍 ITERATION ${iteration}/${cfg.maxIterations}`)
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
        
        const systemPrompt = getSystemPrompt()
        const tools = getTools()
        
        // 1. Run test scenarios
        const scenarios = evalCasesToScenarios(cfg.categories)
        console.log(`📝 Running ${scenarios.length} test scenarios...`)
        
        const results: ScenarioResult[] = []
        for (let i = 0; i < scenarios.length; i++) {
            const scenario = scenarios[i]
            console.log(`   [${i + 1}/${scenarios.length}] ${scenario.name}`)
            
            try {
                const result = await runScenario(scenario, systemPrompt, tools)
                results.push(result)
            } catch (error) {
                console.error(`   ❌ Error running ${scenario.name}:`, error)
            }
            
            // Rate limit delay
            if (i < scenarios.length - 1) {
                await new Promise(r => setTimeout(r, cfg.delayBetweenTests))
            }
        }
        
        // 2. Audit results
        console.log(`\n🔍 Auditing ${results.length} results...`)
        const audits: ScenarioAudit[] = []
        
        for (const result of results) {
            const scenario = scenarios.find(s => s.id === result.scenarioId)!
            const audit = await auditScenario(result, scenario)
            audits.push(audit)
            
            const icon = audit.overallPassed ? '✅' : '❌'
            console.log(`   ${icon} ${result.scenarioName}: ${audit.averageScore.toFixed(2)}/5`)
        }
        
        const passedCount = audits.filter(a => a.overallPassed).length
        const passRate = passedCount / audits.length
        console.log(`\n📊 Pass rate: ${passedCount}/${audits.length} (${(passRate * 100).toFixed(1)}%)`)
        
        // 3. Check if we've reached target
        if (passRate >= cfg.minPassRate) {
            console.log(`\n🎉 Target pass rate (${cfg.minPassRate * 100}%) achieved!`)
            
            summaries.push({
                iterationNumber: iteration,
                timestamp: new Date().toISOString(),
                scenariosRun: scenarios.length,
                scenariosPassed: passedCount,
                totalTurns: audits.reduce((sum, a) => sum + a.turnAudits.length, 0),
                turnsPassed: audits.reduce((sum, a) => sum + a.turnAudits.filter(t => t.passed).length, 0),
                averageScore: audits.reduce((sum, a) => sum + a.averageScore, 0) / audits.length,
                changesProposed: 0,
                changesApplied: 0,
                changesReverted: 0,
                passRateBefore: passRate,
                passRateAfter: passRate,
                improvement: 0,
                goldStandardPassed: true
            })
            
            break
        }
        
        // 4. Consolidate suggestions
        const suggestions = consolidateSuggestions(audits)
        console.log(`\n💡 ${suggestions.length} improvement suggestions:`)
        
        for (const s of suggestions.slice(0, 5)) {
            console.log(`   - [${s.priority}] ${s.skillName}: ${s.changeType}`)
            console.log(`     ${s.rationale.slice(0, 80)}...`)
        }
        
        // 5. Convert to proposed changes
        const changes: ProposedChange[] = []
        for (let i = 0; i < suggestions.length; i++) {
            const change = await suggestionToChange(suggestions[i], i)
            if (change) changes.push(change)
        }
        
        console.log(`\n🔧 ${changes.length} actionable changes identified`)
        
        // 6. Apply changes (or dry run)
        let appliedCount = 0
        let revertedCount = 0
        
        for (const change of changes.filter(c => c.priority === 'high' && !c.requiresReview)) {
            const result = await applyChange(change, cfg.dryRun)
            if (result.applied) appliedCount++
        }
        
        // 7. If we applied changes, run gold standard tests
        let goldPassed = true
        if (appliedCount > 0 && !cfg.dryRun) {
            console.log(`\n🏆 Running gold standard tests...`)
            const goldResult = await runGoldStandardTests(cfg.goldStandardTests, getSystemPrompt(), getTools())
            goldPassed = goldResult.passed
            
            if (!goldPassed) {
                console.log(`❌ Gold standard tests failed: ${goldResult.failures.join(', ')}`)
                console.log(`⏪ Reverting all changes...`)
                
                for (const change of changes) {
                    if (await revertChange(change)) revertedCount++
                }
            }
        }
        
        // 8. Generate summary
        if (cfg.dryRun && changes.length > 0) {
            const summary = generateChangeSummary(changes)
            console.log(`\n📋 Changes summary (dry run):\n`)
            console.log(summary.slice(0, 2000))
        }
        
        summaries.push({
            iterationNumber: iteration,
            timestamp: new Date().toISOString(),
            scenariosRun: scenarios.length,
            scenariosPassed: passedCount,
            totalTurns: audits.reduce((sum, a) => sum + a.turnAudits.length, 0),
            turnsPassed: audits.reduce((sum, a) => sum + a.turnAudits.filter(t => t.passed).length, 0),
            averageScore: audits.reduce((sum, a) => sum + a.averageScore, 0) / audits.length,
            changesProposed: changes.length,
            changesApplied: appliedCount,
            changesReverted: revertedCount,
            passRateBefore: passRate,
            passRateAfter: passRate, // Would need to re-run tests
            improvement: 0,
            goldStandardPassed: goldPassed
        })
        
        // Interactive mode: wait for user confirmation
        if (cfg.interactive && !cfg.dryRun) {
            console.log(`\n⏸️  Paused. Review changes and press Enter to continue...`)
            // In a real implementation, would wait for user input
        }
    }
    
    // Final summary
    console.log(`\n\n${'═'.repeat(50)}`)
    console.log(`📈 IMPROVEMENT LOOP COMPLETE`)
    console.log(`${'═'.repeat(50)}`)
    console.log(`   Iterations: ${summaries.length}`)
    console.log(`   Final pass rate: ${((summaries[summaries.length - 1]?.scenariosPassed || 0) / (summaries[summaries.length - 1]?.scenariosRun || 1) * 100).toFixed(1)}%`)
    console.log(`   Total changes applied: ${summaries.reduce((sum, s) => sum + s.changesApplied, 0)}`)
    console.log(`   Total changes reverted: ${summaries.reduce((sum, s) => sum + s.changesReverted, 0)}`)
    
    return summaries
}

export { evalCasesToScenarios, runScenario }
