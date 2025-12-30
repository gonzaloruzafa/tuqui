/**
 * Test Runner: 100 Preguntas de Negocio + 20 Conversaciones Encadenadas
 * 
 * Evalúa cómo responde Tuqui a preguntas reales de un gerente/dueño
 */

import 'dotenv-flow/config'
import { GoogleGenerativeAI, Content } from '@google/generative-ai'
import { generateOdooSystemPrompt } from '../lib/odoo/prompts'
import { 
    BUSINESS_QUESTIONS, 
    CONVERSATION_CHAINS, 
    BusinessQuestion,
    ConversationChain,
    getStats
} from './business-questions'
import * as fs from 'fs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const systemPrompt = generateOdooSystemPrompt()

interface TestResult {
    id: number | string
    question: string
    category: string
    complexity?: string
    response: string
    success: boolean
    hasData: boolean
    askedClarification: boolean
    usedContext?: boolean
    errorMessage?: string
    durationMs: number
}

// Detectar si la respuesta tiene datos útiles
function evaluateResponse(response: string): { hasData: boolean, askedClarification: boolean } {
    const hasData = 
        response.includes('$') ||
        /\d+[.,]\d+/.test(response) ||
        response.includes('total') ||
        response.includes('vendedor') ||
        response.includes('cliente') ||
        response.includes('producto') ||
        /\d+\s*(unidades|pedidos|facturas|órdenes)/.test(response.toLowerCase())
    
    const askedClarification = 
        response.toLowerCase().includes('¿a qué') ||
        response.toLowerCase().includes('¿te refieres') ||
        response.toLowerCase().includes('¿qué aspecto') ||
        response.toLowerCase().includes('¿podrías especificar') ||
        response.toLowerCase().includes('necesito más información') ||
        response.toLowerCase().includes('¿qué modelo') ||
        (response.includes('?') && response.split('?').length > 2 && !hasData)
    
    return { hasData, askedClarification }
}

// Test una pregunta individual
async function testSingleQuestion(question: string, history: Content[] = []): Promise<{ response: string, durationMs: number, error?: string }> {
    const start = Date.now()
    
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: systemPrompt
        })
        
        const chat = model.startChat({ history })
        const result = await chat.sendMessage(question)
        const response = result.response.text()
        
        return { response, durationMs: Date.now() - start }
    } catch (e: any) {
        return { response: '', durationMs: Date.now() - start, error: e.message }
    }
}

// Test preguntas individuales
async function testIndividualQuestions(questions: BusinessQuestion[], limit?: number): Promise<TestResult[]> {
    const toTest = limit ? questions.slice(0, limit) : questions
    const results: TestResult[] = []
    
    console.log('\n' + '='.repeat(70))
    console.log('📝 TEST: PREGUNTAS INDIVIDUALES')
    console.log('='.repeat(70))
    console.log(`Testeando ${toTest.length} preguntas...\n`)
    
    for (let i = 0; i < toTest.length; i++) {
        const q = toTest[i]
        
        process.stdout.write(`[${i + 1}/${toTest.length}] ${q.question.substring(0, 50)}...`)
        
        const { response, durationMs, error } = await testSingleQuestion(q.question)
        
        if (error) {
            console.log(` ❌ Error`)
            results.push({
                id: q.id,
                question: q.question,
                category: q.category,
                complexity: q.complexity,
                response: '',
                success: false,
                hasData: false,
                askedClarification: false,
                errorMessage: error,
                durationMs
            })
        } else {
            const { hasData, askedClarification } = evaluateResponse(response)
            const success = hasData && !askedClarification
            
            if (askedClarification) {
                console.log(` ❓ Clarif (${durationMs}ms)`)
            } else if (hasData) {
                console.log(` ✅ (${durationMs}ms)`)
            } else {
                console.log(` ⚠️ Sin datos (${durationMs}ms)`)
            }
            
            results.push({
                id: q.id,
                question: q.question,
                category: q.category,
                complexity: q.complexity,
                response,
                success,
                hasData,
                askedClarification,
                durationMs
            })
        }
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 300))
    }
    
    return results
}

// Test conversaciones encadenadas
async function testConversationChains(chains: ConversationChain[], limit?: number): Promise<TestResult[]> {
    const toTest = limit ? chains.slice(0, limit) : chains
    const results: TestResult[] = []
    
    console.log('\n' + '='.repeat(70))
    console.log('🔗 TEST: CONVERSACIONES ENCADENADAS')
    console.log('='.repeat(70))
    console.log(`Testeando ${toTest.length} conversaciones...\n`)
    
    for (const chain of toTest) {
        console.log(`\n[${chain.id}] ${chain.name}`)
        
        // Construir historial de la conversación
        const history: Content[] = chain.messages.slice(0, -1).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }))
        
        const lastQuestion = chain.messages[chain.messages.length - 1].content
        console.log(`   Historial: ${chain.messages.length - 1} mensajes`)
        console.log(`   Pregunta: "${lastQuestion}"`)
        
        const { response, durationMs, error } = await testSingleQuestion(lastQuestion, history)
        
        if (error) {
            console.log(`   ❌ Error: ${error.substring(0, 50)}`)
            results.push({
                id: chain.id,
                question: lastQuestion,
                category: chain.category,
                response: '',
                success: false,
                hasData: false,
                askedClarification: false,
                usedContext: false,
                errorMessage: error,
                durationMs
            })
        } else {
            const { hasData, askedClarification } = evaluateResponse(response)
            
            // Detectar si usó el contexto
            const usedContext = !askedClarification && (
                response.toLowerCase().includes(chain.messages[1]?.content?.toLowerCase().substring(0, 20) || '') ||
                hasData
            )
            
            const success = hasData && !askedClarification
            
            if (askedClarification) {
                console.log(`   ❓ Pidió clarificación (NO usó contexto)`)
                console.log(`   "${response.substring(0, 80)}..."`)
            } else if (usedContext) {
                console.log(`   ✅ Usó contexto correctamente (${durationMs}ms)`)
                console.log(`   "${response.substring(0, 80).replace(/\n/g, ' ')}..."`)
            } else {
                console.log(`   ⚠️ Respondió pero no está claro si usó contexto`)
                console.log(`   "${response.substring(0, 80).replace(/\n/g, ' ')}..."`)
            }
            
            results.push({
                id: chain.id,
                question: lastQuestion,
                category: chain.category,
                response,
                success,
                hasData,
                askedClarification,
                usedContext,
                durationMs
            })
        }
        
        await new Promise(r => setTimeout(r, 500))
    }
    
    return results
}

// Generar reporte
function generateReport(individualResults: TestResult[], chainResults: TestResult[]) {
    console.log('\n' + '='.repeat(70))
    console.log('📊 REPORTE FINAL')
    console.log('='.repeat(70))
    
    // Estadísticas individuales
    const indSuccess = individualResults.filter(r => r.success).length
    const indClarif = individualResults.filter(r => r.askedClarification).length
    const indNoData = individualResults.filter(r => !r.hasData && !r.askedClarification && !r.errorMessage).length
    const indErrors = individualResults.filter(r => r.errorMessage).length
    
    console.log('\n📝 PREGUNTAS INDIVIDUALES')
    console.log(`   Total: ${individualResults.length}`)
    console.log(`   ✅ Exitosas: ${indSuccess} (${(indSuccess/individualResults.length*100).toFixed(1)}%)`)
    console.log(`   ❓ Pidieron clarificación: ${indClarif}`)
    console.log(`   ⚠️ Sin datos: ${indNoData}`)
    console.log(`   ❌ Errores: ${indErrors}`)
    
    // Por categoría
    console.log('\n   Por categoría:')
    const byCategory: Record<string, { success: number, total: number, clarif: number }> = {}
    for (const r of individualResults) {
        if (!byCategory[r.category]) {
            byCategory[r.category] = { success: 0, total: 0, clarif: 0 }
        }
        byCategory[r.category].total++
        if (r.success) byCategory[r.category].success++
        if (r.askedClarification) byCategory[r.category].clarif++
    }
    
    for (const [cat, stats] of Object.entries(byCategory)) {
        const rate = (stats.success / stats.total * 100).toFixed(0)
        console.log(`      ${cat}: ${stats.success}/${stats.total} (${rate}%) - ${stats.clarif} clarif`)
    }
    
    // Por complejidad
    console.log('\n   Por complejidad:')
    const byComplexity: Record<string, { success: number, total: number }> = {}
    for (const r of individualResults) {
        const comp = r.complexity || 'unknown'
        if (!byComplexity[comp]) {
            byComplexity[comp] = { success: 0, total: 0 }
        }
        byComplexity[comp].total++
        if (r.success) byComplexity[comp].success++
    }
    
    for (const [comp, stats] of Object.entries(byComplexity)) {
        const rate = (stats.success / stats.total * 100).toFixed(0)
        console.log(`      ${comp}: ${stats.success}/${stats.total} (${rate}%)`)
    }
    
    // Estadísticas de conversaciones
    const chainSuccess = chainResults.filter(r => r.success).length
    const chainContext = chainResults.filter(r => r.usedContext).length
    const chainClarif = chainResults.filter(r => r.askedClarification).length
    
    console.log('\n🔗 CONVERSACIONES ENCADENADAS')
    console.log(`   Total: ${chainResults.length}`)
    console.log(`   ✅ Exitosas: ${chainSuccess} (${(chainSuccess/chainResults.length*100).toFixed(1)}%)`)
    console.log(`   🧠 Usaron contexto: ${chainContext}`)
    console.log(`   ❓ Pidieron clarificación: ${chainClarif}`)
    
    // Problemas principales
    console.log('\n🔴 PRINCIPALES PROBLEMAS')
    
    console.log('\n   Preguntas que pidieron clarificación:')
    individualResults.filter(r => r.askedClarification).slice(0, 10).forEach(r => {
        console.log(`      - [${r.category}] "${r.question.substring(0, 50)}..."`)
    })
    
    console.log('\n   Conversaciones que no usaron contexto:')
    chainResults.filter(r => r.askedClarification).forEach(r => {
        console.log(`      - [${r.id}] "${r.question}"`)
    })
    
    // Guardar resultados detallados
    const fullReport = {
        timestamp: new Date().toISOString(),
        summary: {
            individual: {
                total: individualResults.length,
                success: indSuccess,
                clarifications: indClarif,
                noData: indNoData,
                errors: indErrors,
                successRate: (indSuccess/individualResults.length*100).toFixed(1) + '%'
            },
            chains: {
                total: chainResults.length,
                success: chainSuccess,
                usedContext: chainContext,
                clarifications: chainClarif,
                successRate: (chainSuccess/chainResults.length*100).toFixed(1) + '%'
            },
            byCategory,
            byComplexity
        },
        individualResults,
        chainResults
    }
    
    const filename = `business-test-results-${new Date().toISOString().split('T')[0]}.json`
    fs.writeFileSync(filename, JSON.stringify(fullReport, null, 2))
    console.log(`\n💾 Resultados guardados en: ${filename}`)
    
    return fullReport
}

// Main
async function main() {
    const args = process.argv.slice(2)
    const mode = args[0] || 'all'
    const limit = args[1] ? parseInt(args[1]) : undefined
    
    console.log('🧪 Test de Preguntas de Negocio para Tuqui')
    console.log('Modo:', mode, limit ? `(límite: ${limit})` : '')
    
    const stats = getStats()
    console.log(`\nTotal preguntas: ${stats.totalQuestions}`)
    console.log(`Total conversaciones: ${stats.totalChains}`)
    console.log('Por categoría:', Object.entries(stats.byCategory).map(([k,v]) => `${k}:${v}`).join(', '))
    console.log('Por complejidad:', Object.entries(stats.byComplexity).map(([k,v]) => `${k}:${v}`).join(', '))
    
    let individualResults: TestResult[] = []
    let chainResults: TestResult[] = []
    
    if (mode === 'individual' || mode === 'all') {
        individualResults = await testIndividualQuestions(BUSINESS_QUESTIONS, limit)
    }
    
    if (mode === 'chains' || mode === 'all') {
        chainResults = await testConversationChains(CONVERSATION_CHAINS, limit)
    }
    
    if (mode === 'quick') {
        // Test rápido: 20 preguntas + 5 conversaciones
        individualResults = await testIndividualQuestions(BUSINESS_QUESTIONS.slice(0, 20))
        chainResults = await testConversationChains(CONVERSATION_CHAINS.slice(0, 5))
    }
    
    generateReport(individualResults, chainResults)
}

main().catch(console.error)
