/**
 * Business Intelligence Test Runner
 */
import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'

const CONFIG = {
    prodUrl: 'https://tuqui-agents-alpha.vercel.app',
    localUrl: 'http://localhost:3000',
    testEndpoint: '/api/internal/chat-test',
    internalKey: process.env.INTERNAL_TEST_KEY || 'test-key-change-in-prod',
    defaultTimeout: 60000,
    meliTimeout: 180000,
    delayBetweenTests: 1500,
    delayBetweenSteps: 2000,
}

interface SingleTest {
    id: string
    category: string
    message: string
    expectedAgent?: string
    shouldContain?: string[]
    shouldNotSay?: string[]
    priority: 'high' | 'medium' | 'low'
}

interface ChainTest {
    id: string
    category: 'CHAIN'
    description: string
    steps: { message: string; shouldContain?: string[]; expectedAgent?: string }[]
    priority: 'high' | 'medium' | 'low'
}

type Test = SingleTest | ChainTest

interface TestResult {
    id: string
    category: string
    passed: boolean
    latencyMs: number
    question: string
    response: string
    agent: string | null
    toolsUsed: string[]
    failures: string[]
    steps?: any[]
}

interface CategoryResult {
    category: string
    name: string
    passed: number
    failed: number
    tests: TestResult[]
}

function parseArgs() {
    const args = process.argv.slice(2)
    const result = { env: 'prod', category: undefined as string | undefined, exportMd: false, verbose: false }
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--env' && args[i + 1]) { result.env = args[i + 1]; i++ }
        else if (args[i] === '--category' && args[i + 1]) { result.category = args[i + 1].toUpperCase(); i++ }
        else if (args[i] === '--export' || args[i] === '-e') { result.exportMd = true }
        else if (args[i] === '--verbose' || args[i] === '-v') { result.verbose = true }
    }
    return result
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function isChainTest(test: Test): test is ChainTest {
    return 'steps' in test
}

function getTimeout(category: string): number {
    return category === 'MELI' ? CONFIG.meliTimeout : CONFIG.defaultTimeout
}

async function callChatAPI(baseUrl: string, tenantId: string, messages: any[], sessionId: string, timeout: number): Promise<any> {
    const url = baseUrl + CONFIG.testEndpoint + '?key=' + CONFIG.internalKey
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, messages, sessionId, streaming: false }),
        signal: AbortSignal.timeout(timeout)
    })
    
    if (!response.ok) {
        const text = await response.text()
        throw new Error('HTTP ' + response.status + ': ' + text)
    }
    return response.json()
}

async function runSingleTest(baseUrl: string, tenantId: string, test: SingleTest, verbose: boolean): Promise<TestResult> {
    const startTime = Date.now()
    const failures: string[] = []
    const sessionId = 'bi-' + test.id + '-' + Date.now()
    const timeout = getTimeout(test.category)
    
    try {
        const result = await callChatAPI(baseUrl, tenantId, [{ role: 'user', content: test.message }], sessionId, timeout)
        
        const latencyMs = result.latencyMs || (Date.now() - startTime)
        const response = result.response || ''
        const agent = result.routing?.selectedAgent || result.agent?.slug || null
        const toolsUsed = result.toolsUsed || result.toolCalls?.map((t: any) => t.name) || []
        
        // Validate shouldContain
        if (test.shouldContain) {
            for (const keyword of test.shouldContain) {
                if (!response.toLowerCase().includes(keyword.toLowerCase())) {
                    failures.push('Should contain "' + keyword + '"')
                }
            }
        }
        
        // Validate shouldNotSay
        if (test.shouldNotSay) {
            for (const phrase of test.shouldNotSay) {
                if (response.toLowerCase().includes(phrase.toLowerCase())) {
                    failures.push('Should NOT say "' + phrase + '"')
                }
            }
        }
        
        return { id: test.id, category: test.category, passed: failures.length === 0, latencyMs, question: test.message, response, agent, toolsUsed, failures }
    } catch (error: any) {
        return { id: test.id, category: test.category, passed: false, latencyMs: Date.now() - startTime, question: test.message, response: '', agent: null, toolsUsed: [], failures: ['Error: ' + error.message] }
    }
}

async function runChainTest(baseUrl: string, tenantId: string, test: ChainTest, verbose: boolean): Promise<TestResult> {
    const sessionId = 'bi-chain-' + test.id + '-' + Date.now()
    const steps: any[] = []
    const conversationHistory: any[] = []
    let allPassed = true
    
    for (let i = 0; i < test.steps.length; i++) {
        const step = test.steps[i]
        const stepStart = Date.now()
        const stepFailures: string[] = []
        
        conversationHistory.push({ role: 'user', content: step.message })
        
        try {
            const timeout = step.expectedAgent === 'meli' ? CONFIG.meliTimeout : CONFIG.defaultTimeout
            const result = await callChatAPI(baseUrl, tenantId, conversationHistory, sessionId, timeout)
            
            const response = result.response || ''
            const agent = result.routing?.selectedAgent || result.agent?.slug || null
            
            conversationHistory.push({ role: 'assistant', content: response })
            
            if (step.shouldContain) {
                for (const keyword of step.shouldContain) {
                    if (!response.toLowerCase().includes(keyword.toLowerCase())) {
                        stepFailures.push('Should contain "' + keyword + '"')
                    }
                }
            }
            
            const stepPassed = stepFailures.length === 0
            if (!stepPassed) allPassed = false
            
            steps.push({ step: i + 1, question: step.message, response, passed: stepPassed, agent, latencyMs: result.latencyMs || (Date.now() - stepStart), failures: stepFailures })
            
            if (verbose) {
                const icon = stepPassed ? '✅' : '❌'
                console.log('      Step ' + (i + 1) + ': ' + icon + ' → ' + (agent || 'base'))
            }
        } catch (error: any) {
            allPassed = false
            steps.push({ step: i + 1, question: step.message, response: '', passed: false, agent: null, latencyMs: Date.now() - stepStart, failures: ['Error: ' + error.message] })
            break
        }
        
        if (i < test.steps.length - 1) await sleep(CONFIG.delayBetweenSteps)
    }
    
    const totalLatency = steps.reduce((sum: number, s: any) => sum + s.latencyMs, 0)
    const allFailures = steps.flatMap((s: any) => s.failures.map((f: string) => 'Step ' + s.step + ': ' + f))
    
    return { id: test.id, category: test.category, passed: allPassed, latencyMs: totalLatency, question: test.description, response: steps.map((s: any) => s.response).join('\n---\n'), agent: steps[steps.length - 1]?.agent || null, toolsUsed: [], failures: allFailures, steps }
}

function printResults(results: CategoryResult[]): void {
    console.log('\n' + '═'.repeat(60))
    console.log('📊 BUSINESS INTELLIGENCE TEST RESULTS')
    console.log('═'.repeat(60))
    
    let totalPassed = 0, totalFailed = 0
    
    for (const cat of results) {
        totalPassed += cat.passed
        totalFailed += cat.failed
        const icon = cat.failed === 0 ? '✅' : '❌'
        const pct = ((cat.passed / (cat.passed + cat.failed)) * 100).toFixed(0)
        console.log('\n' + icon + ' ' + cat.name + ' (' + cat.category + ')')
        console.log('   ' + cat.passed + '/' + (cat.passed + cat.failed) + ' passed (' + pct + '%)')
        for (const test of cat.tests.filter(t => !t.passed)) {
            console.log('   ❌ ' + test.id + ': ' + test.failures.slice(0, 2).join(', '))
        }
    }
    
    const total = totalPassed + totalFailed
    const rate = ((totalPassed / total) * 100).toFixed(1)
    console.log('\n' + '═'.repeat(60))
    console.log('🎯 TOTAL: ' + totalPassed + '/' + total + ' passed (' + rate + '%)')
    console.log('═'.repeat(60))
}

function saveResults(results: CategoryResult[]): void {
    const resultsDir = path.join(__dirname, 'results')
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true })
    
    const timestamp = new Date().toISOString().split('T')[0]
    const jsonFile = path.join(resultsDir, 'bi-results-' + timestamp + '.json')
    const jsonData = { timestamp: new Date().toISOString(), totalPassed: results.reduce((sum, r) => sum + r.passed, 0), totalFailed: results.reduce((sum, r) => sum + r.failed, 0), categories: results }
    fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2))
    console.log('📁 Results saved: ' + jsonFile)
}

async function main() {
    const args = parseArgs()
    const baseUrl = args.env === 'local' ? CONFIG.localUrl : CONFIG.prodUrl
    
    console.log('\n🧪 BUSINESS INTELLIGENCE TEST RUNNER')
    console.log('═'.repeat(60))
    console.log('🌐 Environment: ' + args.env + ' (' + baseUrl + ')')
    
    const suitePath = path.join(__dirname, 'business-intelligence-tests.json')
    if (!fs.existsSync(suitePath)) {
        console.error('❌ Test file not found: ' + suitePath)
        process.exit(1)
    }
    
    const suite = JSON.parse(fs.readFileSync(suitePath, 'utf8'))
    console.log('📁 Loaded: ' + suite.name)
    console.log('🏢 Tenant: ' + suite.tenantId)
    
    let tests: Test[] = suite.tests
    if (args.category) {
        tests = tests.filter((t: Test) => t.category === args.category)
        console.log('🔍 Filtered to category: ' + args.category)
    }
    
    console.log('📋 Tests to run: ' + tests.length)
    if (tests.length === 0) { console.log('⚠️  No tests match'); process.exit(0) }
    
    // Group by category
    const byCategory: Record<string, Test[]> = {}
    for (const test of tests) {
        if (!byCategory[test.category]) byCategory[test.category] = []
        byCategory[test.category].push(test)
    }
    
    const results: CategoryResult[] = []
    
    for (const [categoryId, categoryTests] of Object.entries(byCategory)) {
        const catInfo = suite.categories.find((c: any) => c.id === categoryId)
        const catName = catInfo?.name || categoryId
        
        console.log('\n' + '─'.repeat(60))
        console.log('📦 ' + catName + ' (' + categoryId + ')')
        console.log('─'.repeat(60))
        
        const testResults: TestResult[] = []
        let passed = 0, failed = 0
        
        for (const test of categoryTests) {
            process.stdout.write('   ' + test.id + ': ')
            
            let result: TestResult
            if (isChainTest(test)) {
                console.log('🔗 Multi-turn')
                result = await runChainTest(baseUrl, suite.tenantId, test, args.verbose)
            } else {
                result = await runSingleTest(baseUrl, suite.tenantId, test as SingleTest, args.verbose)
            }
            
            testResults.push(result)
            
            if (result.passed) {
                passed++
                if (!isChainTest(test)) console.log('✅ (' + result.latencyMs + 'ms) → ' + (result.agent || 'base'))
                else console.log('   ✅ All steps passed')
            } else {
                failed++
                console.log('❌ (' + result.latencyMs + 'ms)')
                for (const f of result.failures.slice(0, 3)) console.log('      ⚠️  ' + f)
            }
            
            await sleep(CONFIG.delayBetweenTests)
        }
        
        results.push({ category: categoryId, name: catName, passed, failed, tests: testResults })
    }
    
    printResults(results)
    saveResults(results)
    
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0)
    process.exit(totalFailed > 0 ? 1 : 0)
}

main().catch(console.error)
