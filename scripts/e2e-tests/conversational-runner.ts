/**
 * Conversational Context Test Runner
 *
 * Ejecuta tests de conversaciones multi-turn con análisis de:
 * - Context awareness (¿recuerda datos previos?)
 * - Tool execution reliability (¿ejecuta tools cuando debe?)
 * - Routing consistency (¿mantiene agente correcto?)
 * - Performance metrics (latencia, timeouts)
 * - Data quality (¿usa nombres reales vs placeholders?)
 */

import fs from 'fs'
import path from 'path'

// ============================================
// TYPES
// ============================================

interface Turn {
  turn: number
  message: string
  expectedAgent: string
  shouldContain?: string[]
  shouldNotSay?: string[]
  mustExecuteTool?: string
  mustUseContext?: string | string[]
  contextAware?: boolean
  timeoutMs?: number
  saveContext?: {
    key: string
    extractPattern: string
  }
}

interface Conversation {
  id: string
  category: string
  name: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  expectedBehavior: {
    routing: string
    toolExecution: string
    dataConsistency?: string
    insights?: string
    errorHandling?: string
    responseQuality?: string
    dataQuality?: string
  }
  turns: Turn[]
}

interface TestSuite {
  name: string
  description: string
  tenantId: string
  conversations: Conversation[]
  performanceBaselines: {
    maxLatencyPerTurn: number
    maxConversationTime: number
    minToolExecutionRate: number
    minContextAwarenessRate: number
    minSuccessRate: number
  }
}

interface TurnResult {
  turn: number
  message: string
  response: string
  agent: string | null
  toolsUsed: string[]
  latencyMs: number
  passed: boolean
  failures: string[]
  savedContext?: Record<string, string>
  usedContext?: string[]
}

interface ConversationResult {
  id: string
  name: string
  category: string
  passed: boolean
  totalTurns: number
  passedTurns: number
  totalLatencyMs: number
  avgLatencyMs: number
  turnResults: TurnResult[]
  contextPreservation: number // 0-1
  toolExecutionRate: number // 0-1
  routingConsistency: number // 0-1
  failures: string[]
}

interface TestReport {
  timestamp: string
  totalConversations: number
  passedConversations: number
  totalTurns: number
  passedTurns: number
  successRate: number
  avgLatencyMs: number
  totalLatencyMs: number
  metrics: {
    contextPreservation: number
    toolExecutionRate: number
    routingConsistency: number
    dataQuality: number
  }
  conversations: ConversationResult[]
  performanceVsBaseline: {
    metric: string
    baseline: number
    actual: number
    passed: boolean
  }[]
}

// ============================================
// CHAT API CLIENT
// ============================================

const API_BASE = process.env.API_BASE || 'http://localhost:3000'

async function sendChatMessage(
  tenantId: string,
  agentSlug: string,
  message: string,
  history: Array<{ role: string; content: string }>,
  timeoutMs: number = 15000
): Promise<{
  response: string
  agent: string | null
  toolsUsed: string[]
  latencyMs: number
}> {
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        agentSlug,
        message,
        history
      }),
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    const latencyMs = Date.now() - startTime

    return {
      response: data.response || '',
      agent: data.routing?.selectedAgent || null,
      toolsUsed: data.toolCalls?.map((tc: any) => tc.name) || [],
      latencyMs
    }
  } catch (error: any) {
    const latencyMs = Date.now() - startTime

    if (error.name === 'AbortError') {
      throw new Error(`Timeout after ${timeoutMs}ms`)
    }

    throw new Error(`Chat API error: ${error.message}`)
  }
}

// ============================================
// CONTEXT EXTRACTOR
// ============================================

function extractContext(text: string, pattern: string): string | null {
  try {
    const regex = new RegExp(pattern, 'i')
    const match = text.match(regex)
    return match ? match[1].trim() : null
  } catch (e) {
    console.error(`[Context] Error extracting with pattern ${pattern}:`, e)
    return null
  }
}

// ============================================
// VALIDATORS
// ============================================

function validateTurn(
  turn: Turn,
  result: {
    response: string
    agent: string | null
    toolsUsed: string[]
  },
  conversationContext: Record<string, string>
): { passed: boolean; failures: string[]; usedContext: string[] } {
  const failures: string[] = []
  const usedContext: string[] = []

  // 1. Check expected content
  if (turn.shouldContain) {
    for (const phrase of turn.shouldContain) {
      if (!result.response.toLowerCase().includes(phrase.toLowerCase())) {
        failures.push(`Should contain "${phrase}"`)
      }
    }
  }

  // 2. Check forbidden content
  if (turn.shouldNotSay) {
    for (const phrase of turn.shouldNotSay) {
      if (result.response.toLowerCase().includes(phrase.toLowerCase())) {
        failures.push(`Should NOT say "${phrase}"`)
      }
    }
  }

  // 3. Check tool execution
  if (turn.mustExecuteTool) {
    if (!result.toolsUsed.includes(turn.mustExecuteTool)) {
      failures.push(`Must execute tool "${turn.mustExecuteTool}" but executed: ${result.toolsUsed.join(', ') || 'none'}`)
    }
  }

  // 4. Check routing
  if (turn.expectedAgent && result.agent !== turn.expectedAgent) {
    failures.push(`Expected agent "${turn.expectedAgent}" but got "${result.agent}"`)
  }

  // 5. Check context usage
  if (turn.mustUseContext) {
    const requiredContextKeys = Array.isArray(turn.mustUseContext)
      ? turn.mustUseContext
      : [turn.mustUseContext]

    for (const key of requiredContextKeys) {
      const contextValue = conversationContext[key]
      if (contextValue) {
        // Check if response references the context value
        if (result.response.includes(contextValue)) {
          usedContext.push(key)
        } else {
          failures.push(`Should use context "${key}" (value: ${contextValue})`)
        }
      } else {
        failures.push(`Context "${key}" not found in conversation history`)
      }
    }
  }

  // 6. Context awareness check (general)
  if (turn.contextAware && turn.turn > 1) {
    // Check if response is not generic
    const genericPhrases = [
      'no tengo información',
      'no puedo ayudarte',
      '¿podrías especificar?',
      '¿de qué cliente hablas?',
      '¿qué producto?'
    ]

    for (const generic of genericPhrases) {
      if (result.response.toLowerCase().includes(generic)) {
        failures.push(`Lost context: response is generic ("${generic}")`)
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    usedContext
  }
}

// ============================================
// CONVERSATION RUNNER
// ============================================

async function runConversation(
  tenantId: string,
  conversation: Conversation
): Promise<ConversationResult> {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🗣️  Running: ${conversation.name}`)
  console.log(`${'='.repeat(80)}\n`)

  const turnResults: TurnResult[] = []
  const conversationContext: Record<string, string> = {}
  const history: Array<{ role: string; content: string }> = []

  let totalLatencyMs = 0
  let passedTurns = 0
  let toolExecutions = 0
  let contextUses = 0
  const agents: string[] = []

  for (const turn of conversation.turns) {
    console.log(`\n📍 Turn ${turn.turn}: "${turn.message}"`)

    try {
      const result = await sendChatMessage(
        tenantId,
        'tuqui', // Always start with main agent, routing will decide
        turn.message,
        history,
        turn.timeoutMs || 15000
      )

      console.log(`   ⏱️  Latency: ${result.latencyMs}ms`)
      console.log(`   🤖 Agent: ${result.agent}`)
      console.log(`   🔧 Tools: ${result.toolsUsed.join(', ') || 'none'}`)
      console.log(`   💬 Response: ${result.response.substring(0, 100)}...`)

      // Save context if specified
      let savedContext: Record<string, string> | undefined
      if (turn.saveContext) {
        const extracted = extractContext(result.response, turn.saveContext.extractPattern)
        if (extracted) {
          conversationContext[turn.saveContext.key] = extracted
          savedContext = { [turn.saveContext.key]: extracted }
          console.log(`   📌 Saved context: ${turn.saveContext.key} = "${extracted}"`)
        }
      }

      // Validate turn
      const validation = validateTurn(turn, result, conversationContext)

      if (validation.passed) {
        console.log(`   ✅ Turn passed`)
        passedTurns++
      } else {
        console.log(`   ❌ Turn failed:`)
        validation.failures.forEach(f => console.log(`      - ${f}`))
      }

      // Update history
      history.push({ role: 'user', content: turn.message })
      history.push({ role: 'assistant', content: result.response })

      // Track metrics
      totalLatencyMs += result.latencyMs
      if (result.toolsUsed.length > 0) toolExecutions++
      if (validation.usedContext.length > 0) contextUses++
      if (result.agent) agents.push(result.agent)

      turnResults.push({
        turn: turn.turn,
        message: turn.message,
        response: result.response,
        agent: result.agent,
        toolsUsed: result.toolsUsed,
        latencyMs: result.latencyMs,
        passed: validation.passed,
        failures: validation.failures,
        savedContext,
        usedContext: validation.usedContext
      })

    } catch (error: any) {
      console.log(`   ❌ Turn failed with error: ${error.message}`)

      turnResults.push({
        turn: turn.turn,
        message: turn.message,
        response: '',
        agent: null,
        toolsUsed: [],
        latencyMs: turn.timeoutMs || 15000,
        passed: false,
        failures: [`Error: ${error.message}`]
      })

      totalLatencyMs += turn.timeoutMs || 15000
    }
  }

  // Calculate metrics
  const contextAwareTurns = conversation.turns.filter(t => t.contextAware).length
  const contextPreservation = contextAwareTurns > 0
    ? contextUses / contextAwareTurns
    : 1

  const turnsRequiringTools = conversation.turns.filter(t => t.mustExecuteTool).length
  const toolExecutionRate = turnsRequiringTools > 0
    ? toolExecutions / turnsRequiringTools
    : 1

  const uniqueAgents = new Set(agents).size
  const routingConsistency = uniqueAgents <= 2 ? 1 : 0.5 // Max 2 agents per conversation is good

  const passed = passedTurns === conversation.turns.length

  return {
    id: conversation.id,
    name: conversation.name,
    category: conversation.category,
    passed,
    totalTurns: conversation.turns.length,
    passedTurns,
    totalLatencyMs,
    avgLatencyMs: Math.round(totalLatencyMs / conversation.turns.length),
    turnResults,
    contextPreservation,
    toolExecutionRate,
    routingConsistency,
    failures: turnResults.flatMap(tr => tr.failures)
  }
}

// ============================================
// MAIN RUNNER
// ============================================

async function runConversationalTests(suiteFile: string) {
  console.log(`\n${'█'.repeat(80)}`)
  console.log(`🚀 Conversational Context Test Runner`)
  console.log(`${'█'.repeat(80)}\n`)

  // Load suite
  const suitePath = path.join(__dirname, suiteFile)
  const suite: TestSuite = JSON.parse(fs.readFileSync(suitePath, 'utf-8'))

  console.log(`📦 Suite: ${suite.name}`)
  console.log(`📝 Description: ${suite.description}`)
  console.log(`🎯 Conversations: ${suite.conversations.length}`)
  console.log(`⏱️  Baselines:`)
  console.log(`   - Max latency per turn: ${suite.performanceBaselines.maxLatencyPerTurn}ms`)
  console.log(`   - Min tool execution rate: ${(suite.performanceBaselines.minToolExecutionRate * 100).toFixed(0)}%`)
  console.log(`   - Min context awareness: ${(suite.performanceBaselines.minContextAwarenessRate * 100).toFixed(0)}%`)
  console.log(`   - Min success rate: ${(suite.performanceBaselines.minSuccessRate * 100).toFixed(0)}%\n`)

  // Run conversations
  const results: ConversationResult[] = []

  for (const conversation of suite.conversations) {
    const result = await runConversation(suite.tenantId, conversation)
    results.push(result)

    // Brief summary
    const status = result.passed ? '✅' : '❌'
    console.log(`\n${status} ${conversation.name}: ${result.passedTurns}/${result.totalTurns} turns passed (${result.avgLatencyMs}ms avg)`)
  }

  // Calculate overall metrics
  const totalConversations = results.length
  const passedConversations = results.filter(r => r.passed).length
  const totalTurns = results.reduce((sum, r) => sum + r.totalTurns, 0)
  const passedTurns = results.reduce((sum, r) => sum + r.passedTurns, 0)
  const totalLatencyMs = results.reduce((sum, r) => sum + r.totalLatencyMs, 0)
  const avgContextPreservation = results.reduce((sum, r) => sum + r.contextPreservation, 0) / totalConversations
  const avgToolExecutionRate = results.reduce((sum, r) => sum + r.toolExecutionRate, 0) / totalConversations
  const avgRoutingConsistency = results.reduce((sum, r) => sum + r.routingConsistency, 0) / totalConversations

  const report: TestReport = {
    timestamp: new Date().toISOString(),
    totalConversations,
    passedConversations,
    totalTurns,
    passedTurns,
    successRate: passedTurns / totalTurns,
    avgLatencyMs: Math.round(totalLatencyMs / totalTurns),
    totalLatencyMs,
    metrics: {
      contextPreservation: avgContextPreservation,
      toolExecutionRate: avgToolExecutionRate,
      routingConsistency: avgRoutingConsistency,
      dataQuality: 1 // TODO: implement data quality checker
    },
    conversations: results,
    performanceVsBaseline: [
      {
        metric: 'Success Rate',
        baseline: suite.performanceBaselines.minSuccessRate,
        actual: passedTurns / totalTurns,
        passed: (passedTurns / totalTurns) >= suite.performanceBaselines.minSuccessRate
      },
      {
        metric: 'Avg Latency',
        baseline: suite.performanceBaselines.maxLatencyPerTurn,
        actual: Math.round(totalLatencyMs / totalTurns),
        passed: (totalLatencyMs / totalTurns) <= suite.performanceBaselines.maxLatencyPerTurn
      },
      {
        metric: 'Tool Execution Rate',
        baseline: suite.performanceBaselines.minToolExecutionRate,
        actual: avgToolExecutionRate,
        passed: avgToolExecutionRate >= suite.performanceBaselines.minToolExecutionRate
      },
      {
        metric: 'Context Awareness',
        baseline: suite.performanceBaselines.minContextAwarenessRate,
        actual: avgContextPreservation,
        passed: avgContextPreservation >= suite.performanceBaselines.minContextAwarenessRate
      }
    ]
  }

  // Print summary
  console.log(`\n${'█'.repeat(80)}`)
  console.log(`📊 SUMMARY REPORT`)
  console.log(`${'█'.repeat(80)}\n`)

  console.log(`✅ Conversations Passed: ${passedConversations}/${totalConversations} (${(passedConversations/totalConversations*100).toFixed(1)}%)`)
  console.log(`✅ Turns Passed: ${passedTurns}/${totalTurns} (${(report.successRate*100).toFixed(1)}%)`)
  console.log(`⏱️  Avg Latency: ${report.avgLatencyMs}ms`)
  console.log(`\n📈 Metrics:`)
  console.log(`   🧠 Context Preservation: ${(avgContextPreservation*100).toFixed(1)}%`)
  console.log(`   🔧 Tool Execution Rate: ${(avgToolExecutionRate*100).toFixed(1)}%`)
  console.log(`   🎯 Routing Consistency: ${(avgRoutingConsistency*100).toFixed(1)}%`)

  console.log(`\n🎯 Performance vs Baseline:`)
  report.performanceVsBaseline.forEach(({ metric, baseline, actual, passed }) => {
    const status = passed ? '✅' : '❌'
    console.log(`   ${status} ${metric}: ${typeof actual === 'number' && actual < 1 ? (actual*100).toFixed(1)+'%' : actual} (baseline: ${typeof baseline === 'number' && baseline < 1 ? (baseline*100).toFixed(0)+'%' : baseline})`)
  })

  // Save report
  const resultsDir = path.join(__dirname, 'results')
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().split('T')[0]
  const reportFile = path.join(resultsDir, `conversational-${timestamp}.json`)
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2))
  console.log(`\n💾 Report saved to: ${reportFile}`)

  // Generate markdown report
  const mdReport = generateMarkdownReport(suite, report)
  const mdFile = path.join(resultsDir, `conversational-${timestamp}.md`)
  fs.writeFileSync(mdFile, mdReport)
  console.log(`📄 Markdown report: ${mdFile}`)

  console.log(`\n${'█'.repeat(80)}\n`)

  // Exit with error if tests failed
  if (report.successRate < suite.performanceBaselines.minSuccessRate) {
    process.exit(1)
  }
}

// ============================================
// MARKDOWN REPORT GENERATOR
// ============================================

function generateMarkdownReport(suite: TestSuite, report: TestReport): string {
  let md = `# 🗣️ Conversational Context Test Report\n\n`
  md += `**Generated**: ${report.timestamp}\n\n`

  md += `## 📊 Summary\n\n`
  md += `| Metric | Value |\n`
  md += `|--------|-------|\n`
  md += `| **Success Rate** | ${(report.successRate * 100).toFixed(1)}% (${report.passedTurns}/${report.totalTurns} turns) |\n`
  md += `| **Conversations Passed** | ${report.passedConversations}/${report.totalConversations} |\n`
  md += `| **Avg Latency** | ${report.avgLatencyMs}ms |\n`
  md += `| **Context Preservation** | ${(report.metrics.contextPreservation * 100).toFixed(1)}% |\n`
  md += `| **Tool Execution Rate** | ${(report.metrics.toolExecutionRate * 100).toFixed(1)}% |\n`
  md += `| **Routing Consistency** | ${(report.metrics.routingConsistency * 100).toFixed(1)}% |\n\n`

  md += `## 🎯 Performance vs Baseline\n\n`
  md += `| Metric | Baseline | Actual | Status |\n`
  md += `|--------|----------|--------|--------|\n`
  report.performanceVsBaseline.forEach(({ metric, baseline, actual, passed }) => {
    const status = passed ? '✅' : '❌'
    const baselineStr = typeof baseline === 'number' && baseline < 1 ? `${(baseline*100).toFixed(0)}%` : baseline
    const actualStr = typeof actual === 'number' && actual < 1 ? `${(actual*100).toFixed(1)}%` : actual
    md += `| ${metric} | ${baselineStr} | ${actualStr} | ${status} |\n`
  })
  md += `\n`

  md += `## 💬 Conversations\n\n`

  for (const conv of report.conversations) {
    const status = conv.passed ? '✅' : '❌'
    md += `### ${status} ${conv.name}\n\n`
    md += `**Category**: ${conv.category} | **Turns**: ${conv.passedTurns}/${conv.totalTurns} passed | **Avg Latency**: ${conv.avgLatencyMs}ms\n\n`

    if (!conv.passed) {
      md += `**Failures**:\n`
      const uniqueFailures = [...new Set(conv.failures)]
      uniqueFailures.forEach(f => md += `- ${f}\n`)
      md += `\n`
    }

    md += `**Turn Details**:\n\n`
    for (const turn of conv.turnResults) {
      const turnStatus = turn.passed ? '✅' : '❌'
      md += `${turnStatus} **Turn ${turn.turn}** (${turn.latencyMs}ms)\n`
      md += `- **User**: "${turn.message}"\n`
      md += `- **Agent**: ${turn.agent || 'unknown'}\n`
      md += `- **Tools**: ${turn.toolsUsed.join(', ') || 'none'}\n`
      md += `- **Response**: ${turn.response.substring(0, 150)}...\n`

      if (turn.savedContext) {
        md += `- **Saved Context**: ${JSON.stringify(turn.savedContext)}\n`
      }
      if (turn.usedContext && turn.usedContext.length > 0) {
        md += `- **Used Context**: ${turn.usedContext.join(', ')}\n`
      }
      if (turn.failures.length > 0) {
        md += `- **Failures**: ${turn.failures.join('; ')}\n`
      }
      md += `\n`
    }
    md += `---\n\n`
  }

  return md
}

// ============================================
// CLI
// ============================================

const suiteFile = process.argv[2] || 'conversational-context-tests.json'
runConversationalTests(suiteFile).catch(console.error)
