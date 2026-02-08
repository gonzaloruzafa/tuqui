/**
 * Improvement Loop Types
 * Defines the data structures for the continuous improvement system
 */

import { ToolCallRecord } from '../tools/llm-engine'

/**
 * A single conversation turn in a test scenario
 */
export interface ConversationTurn {
    userMessage: string
    assistantResponse: string
    toolCalls: ToolCallRecord[]
    latencyMs: number
}

/**
 * A complete test scenario with multiple turns
 */
export interface TestScenario {
    id: string
    name: string
    description: string
    category: 'ventas' | 'compras' | 'stock' | 'cobranzas' | 'tesoreria' | 'comparativas' | 'productos' | 'edge-cases' | 'mercadolibre' | 'rag' | 'ambiguous' | 'multi-skill' | 'insight'
    difficulty: 1 | 2 | 3 | 4 | 5
    requiresValidLinks?: boolean
    turns: {
        userMessage: string
        expectedPatterns?: string[]
        expectedSkills?: string[]
        requiresNumericData?: boolean
    }[]
}

/**
 * Result of running a test scenario
 */
export interface ScenarioResult {
    scenarioId: string
    scenarioName: string
    turns: ConversationTurn[]
    passed: boolean
    totalLatencyMs: number
    timestamp: string
}

/**
 * Audit result for a single response
 */
export interface AuditResult {
    turnIndex: number
    userMessage: string
    assistantResponse: string
    toolsUsed: string[]
    
    // Quality scores (1-5)
    relevanceScore: number
    accuracyScore: number
    completenessScore: number
    toneScore: number
    
    // Overall assessment
    overallScore: number
    passed: boolean
    
    // Issues found
    issues: AuditIssue[]
    
    // Improvement suggestions
    suggestions: ImprovementSuggestion[]
}

/**
 * A specific issue found during audit
 */
export interface AuditIssue {
    severity: 'low' | 'medium' | 'high' | 'critical'
    category: 'wrong_tool' | 'missing_data' | 'hallucination' | 'tone' | 'incomplete' | 'wrong_params' | 'unnecessary_question'
    description: string
    evidence: string
}

/**
 * A suggestion for improving a skill
 */
export interface ImprovementSuggestion {
    skillName: string
    changeType: 'description' | 'parameters' | 'defaults' | 'new_skill' | 'system_prompt'
    priority: 'low' | 'medium' | 'high'
    currentValue?: string
    suggestedValue: string
    rationale: string
}

/**
 * Aggregated audit results for a scenario
 */
export interface ScenarioAudit {
    scenarioId: string
    scenarioName: string
    category: string
    turnAudits: AuditResult[]
    overallPassed: boolean
    averageScore: number
    criticalIssues: AuditIssue[]
    aggregatedSuggestions: ImprovementSuggestion[]
}

/**
 * A proposed change to the codebase
 */
export interface ProposedChange {
    id: string
    skillName: string
    filePath: string
    changeType: 'description' | 'parameters' | 'defaults' | 'system_prompt'
    
    // The actual change
    oldValue: string
    newValue: string
    
    // Metadata
    rationale: string
    priority: 'low' | 'medium' | 'high'
    riskLevel: 'safe' | 'medium' | 'risky'
    
    // Validation
    affectedTests: string[]
    requiresReview: boolean
}

/**
 * Result of applying changes
 */
export interface ChangeResult {
    changeId: string
    applied: boolean
    error?: string
    testsRun: number
    testsPassed: number
    revertRequired: boolean
}

/**
 * Summary of an improvement loop iteration
 */
export interface LoopIterationSummary {
    iterationNumber: number
    timestamp: string
    
    // Scenarios run
    scenariosRun: number
    scenariosPassed: number
    
    // Audit results
    totalTurns: number
    turnsPassed: number
    averageScore: number
    
    // Changes made
    changesProposed: number
    changesApplied: number
    changesReverted: number
    
    // Before/after comparison
    passRateBefore: number
    passRateAfter: number
    improvement: number
    
    // Gold standard check
    goldStandardPassed: boolean
}

/**
 * Configuration for the improvement loop
 */
export interface LoopConfig {
    // Run mode
    dryRun: boolean
    interactive: boolean
    
    // Scope
    categories: string[]
    maxIterations: number
    
    // Progressive loop
    startLevel: 1 | 2 | 3 | 4 | 5
    maxLevel: 1 | 2 | 3 | 4 | 5
    levelThresholds: Record<number, number>
    maxRetriesPerLevel: number
    
    // Thresholds
    minPassRate: number
    minAuditScore: number
    
    // Model
    model: string
    
    // Safety
    requirePrForRiskyChanges: boolean
    goldStandardTests: string[]
    
    // API settings
    delayBetweenTests: number
    maxConcurrentTests: number
}

/**
 * Default configuration
 */
export const DEFAULT_LOOP_CONFIG: LoopConfig = {
    dryRun: true,
    interactive: false,
    categories: ['all'],
    maxIterations: 10,
    startLevel: 1,
    maxLevel: 5,
    levelThresholds: {
        1: 0.95,  // L1 must be near-perfect
        2: 0.85,
        3: 0.85,
        4: 0.75,  // multi-skill is harder
        5: 0.70,  // insights are subjective
    },
    maxRetriesPerLevel: 3,
    minPassRate: 0.85,
    minAuditScore: 3.5,
    model: 'gemini-3-flash-preview',
    requirePrForRiskyChanges: true,
    goldStandardTests: ['ventas-001', 'stock-001', 'cobranzas-001'],
    delayBetweenTests: 4000,
    maxConcurrentTests: 1
}

/**
 * Result of running all tests at a difficulty level
 */
export interface LevelResult {
    level: number
    total: number
    passed: number
    rate: number
    graduated: boolean
    attempts: number
    audits: ScenarioAudit[]
}

/**
 * Output of a complete progressive loop run
 */
export interface ProgressiveLoopResult {
    date: string
    model: string
    levels: Record<number, { total: number; passed: number; rate: number }>
    maxLevelPassed: number
    changesApplied: { skill: string; field: string; diff: string }[]
    regressions: string[]
    duration: number
}
