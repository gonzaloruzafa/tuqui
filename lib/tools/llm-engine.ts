/**
 * Native Gemini V2 - Using @google/genai SDK with Thinking Support
 * 
 * This version uses the new Google GenAI SDK that supports:
 * - Native thinking (Chain of Thought)
 * - Thought summaries that can be streamed to the UI
 * - Better tool/function calling integration
 */

import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai'
import { ThinkingStep, OnThinkingStep, getToolSource, ThinkingSource } from '@/lib/thinking/types'
import { withRetry } from '@/lib/skills/errors'

/**
 * Map string literals to ThinkingLevel enum values (gemini-3-*)
 */
const thinkingLevelMap = {
    'minimal': ThinkingLevel.MINIMAL,
    'low': ThinkingLevel.LOW,
    'medium': ThinkingLevel.MEDIUM,
    'high': ThinkingLevel.HIGH
} as const

/**
 * Map string levels to token budgets (gemini-2.5-*)
 * gemini-2.5-flash uses thinkingBudget instead of thinkingLevel
 */
const thinkingBudgetMap: Record<string, number> = {
    'minimal': 1024,
    'low': 2048,
    'medium': 8192,
    'high': 24576
}

/** Build thinkingConfig based on model capabilities */
function buildThinkingConfig(
    modelName: string,
    level: string | ThinkingLevel,
    includeThoughts: boolean
) {
    if (modelName.includes('gemini-3')) {
        const resolved = typeof level === 'string'
            ? thinkingLevelMap[level as keyof typeof thinkingLevelMap]
            : level
        return { thinkingLevel: resolved, includeThoughts }
    }
    // gemini-2.5-flash and others: use thinkingBudget (tokens)
    const key = typeof level === 'string' ? level : 'medium'
    return { thinkingBudget: thinkingBudgetMap[key] || 8192, includeThoughts }
}

/**
 * Record of a tool call made during generation
 */
export interface ToolCallRecord {
    toolName: string
    args: Record<string, any>
    result: any
    durationMs: number
    error?: string
}

/**
 * Extended result with tool call tracking and thinking
 */
export interface GenerateTextResultWithThinking {
    text: string
    thinkingSummary?: string  // The model's thought summary
    usage: { totalTokens: number; thinkingTokens?: number }
    toolCalls: ToolCallRecord[]
}

/**
 * Callback for streaming thinking summaries
 */
export type OnThinkingSummary = (summary: string) => void

/**
 * Convert Zod schema to Gemini Type format for the new SDK
 */
function zodToGeminiSchema(zodSchema: any): Record<string, any> {
    try {
        if (typeof zodSchema.toJSONSchema !== 'function') {
            return { type: Type.OBJECT, properties: {} }
        }
        
        const jsonSchema = zodSchema.toJSONSchema()
        return convertJsonSchemaToGemini(jsonSchema)
    } catch (error) {
        console.warn('[NativeGeminiV2] Failed to convert Zod schema:', error)
        return { type: Type.OBJECT, properties: {} }
    }
}

function convertJsonSchemaToGemini(schema: any): Record<string, any> {
    if (schema.enum) {
        return { type: Type.STRING, enum: schema.enum, description: schema.description }
    }
    
    if (schema.type === 'array') {
        return {
            type: Type.ARRAY,
            items: schema.items ? convertJsonSchemaToGemini(schema.items) : { type: Type.STRING },
            description: schema.description
        }
    }
    
    if (schema.type === 'object' || schema.properties) {
        const properties: Record<string, any> = {}
        for (const [k, v] of Object.entries(schema.properties || {})) {
            properties[k] = convertJsonSchemaToGemini(v as any)
        }
        return {
            type: Type.OBJECT,
            properties,
            required: schema.required || [],
            description: schema.description
        }
    }
    
    const typeMap: Record<string, any> = {
        'string': Type.STRING,
        'number': Type.NUMBER,
        'integer': Type.INTEGER,
        'boolean': Type.BOOLEAN,
    }
    
    return {
        type: typeMap[schema.type] || Type.STRING,
        description: schema.description
    }
}

/**
 * Detect and truncate repetition loops in LLM output.
 * Gemini sometimes enters infinite loops repeating the same sentence.
 */
function truncateRepetitionLoop(text: string): string {
    if (text.length < 500) return text

    // Split into sentences and find repeated ones
    const sentences = text.split(/(?<=[.!?✨🦷🚀])\s+/)
    if (sentences.length < 5) return text

    // Check if the last N sentences are repeats
    const lastSentence = sentences[sentences.length - 1]?.trim()
    if (!lastSentence || lastSentence.length < 20) return text

    let repeatCount = 0
    for (let i = sentences.length - 1; i >= 0; i--) {
        if (sentences[i]?.trim() === lastSentence) {
            repeatCount++
        } else {
            break
        }
    }

    if (repeatCount >= 3) {
        console.warn(`[NativeGeminiV2] Detected repetition loop (${repeatCount}x), truncating`)
        // Keep everything up to the first repetition + one instance
        const cutIndex = sentences.length - repeatCount + 1
        return sentences.slice(0, cutIndex).join(' ')
    }

    return text
}

/**
 * Generate text with native thinking support using the new SDK
 * 
 * @param onThinkingStep - Callback for tool execution events
 * @param onThinkingSummary - Callback for streaming thinking summaries (Chain of Thought)
 */
export async function generateTextWithThinking({
    model: modelName = 'gemini-3-flash-preview',
    system,
    messages,
    tools,
    maxSteps = 5,
    thinkingLevel = 'medium',
    includeThoughts = true,
    onThinkingStep,
    onThinkingSummary
}: {
    model?: string
    system: string
    messages: any[]
    tools?: Record<string, any>
    maxSteps?: number
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' | ThinkingLevel
    includeThoughts?: boolean
    onThinkingStep?: OnThinkingStep
    onThinkingSummary?: OnThinkingSummary
}): Promise<GenerateTextResultWithThinking> {
    
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    
    const thinkingConfig = buildThinkingConfig(modelName, thinkingLevel, includeThoughts)

    // Convert tools to function declarations
    const functionDeclarations: any[] = []
    
    if (tools) {
        for (const [name, tool] of Object.entries(tools)) {
            if (name === 'web_search') {
                functionDeclarations.push({
                    name,
                    description: tool.description || 'Buscar información en internet',
                    parameters: {
                        type: Type.OBJECT,
                        properties: {
                            query: { type: Type.STRING, description: 'Términos de búsqueda' }
                        },
                        required: ['query']
                    }
                })
            } else if (tool.parameters) {
                try {
                    const params = zodToGeminiSchema(tool.parameters)
                    functionDeclarations.push({
                        name,
                        description: tool.description || `Execute ${name}`,
                        parameters: params
                    })
                } catch (e) {
                    functionDeclarations.push({
                        name,
                        description: tool.description,
                        parameters: { type: Type.OBJECT, properties: {} }
                    })
                }
            }
        }
    }

    // Build conversation contents
    const contents: any[] = []
    
    // Add history (all messages except the last)
    for (const m of messages.slice(0, -1)) {
        contents.push({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        })
    }
    
    // Add the last message
    const lastMessage = messages[messages.length - 1].content
    contents.push({
        role: 'user',
        parts: [{ text: lastMessage }]
    })

    const toolCalls: ToolCallRecord[] = []
    let thinkingSummary = ''
    let totalTokens = 0
    let thinkingTokens = 0
    let finalText = ''

    try {
        // Initial request with thinking enabled - with retry for transient errors
        let response = await withRetry(
            () => client.models.generateContent({
                model: modelName,
                contents,
                config: {
                    systemInstruction: system,
                    maxOutputTokens: 4096,
                    tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
                    thinkingConfig
                }
            }),
            {
                maxAttempts: 3,
                initialDelayMs: 1000,
                maxDelayMs: 8000,
                onRetry: (attempt, error) => {
                    console.log(`[NativeGeminiV2] Retry ${attempt}/3 after error:`, (error as Error).message?.slice(0, 100))
                }
            }
        )

        // Track usage
        if (response.usageMetadata) {
            totalTokens = response.usageMetadata.totalTokenCount || 0
            thinkingTokens = response.usageMetadata.thoughtsTokenCount || 0
        }

        // Process response parts for thinking and function calls
        for (let step = 0; step < maxSteps; step++) {
            const parts = response.candidates?.[0]?.content?.parts || []
            
            // Collect thinking summaries and function calls
            const functionCallParts: any[] = []
            let stepText = ''  // Collect text for this step only
            
            for (const part of parts) {
                // Check for thought summary
                if (part.thought && part.text) {
                    thinkingSummary += part.text
                    if (onThinkingSummary) {
                        onThinkingSummary(part.text)
                    }
                }
                
                // Check for function call
                if (part.functionCall) {
                    functionCallParts.push(part)
                }
                
                // Check for regular text
                if (!part.thought && part.text) {
                    stepText += part.text
                }
            }

            // Only add text to final output if there are NO function calls
            // (otherwise the model is requesting tools, not giving final answer)
            if (functionCallParts.length === 0) {
                finalText += stepText
                break
            }

            // Execute all function calls
            const functionResponses: any[] = []
            
            for (const part of functionCallParts) {
                const { name, args } = part.functionCall
                console.log(`[NativeGeminiV2] Executing ${name} with args:`, args)

                const tool = tools?.[name]
                let toolResult: any
                let error: string | undefined
                const startTime = Date.now()
                const source = getToolSource(name)
                const isBlockedGoogleSearch = name.startsWith('google_search') && !(tools && 'web_search' in tools)
                
                // Emit thinking step: running (skip for blocked google_search)
                if (onThinkingStep && !isBlockedGoogleSearch) {
                    onThinkingStep({
                        tool: name,
                        source,
                        status: 'running',
                        startedAt: startTime
                    })
                }
                
                if (!tool || !tool.execute) {
                    // Google Search grounding — Gemini may invoke natively
                    if (name.startsWith('google_search')) {
                        const hasWebSearch = tools && 'web_search' in tools
                        if (hasWebSearch) {
                            // Agent has web_search → allow grounding
                            toolResult = { result: 'Google Search grounding executed by model' }
                        } else {
                            // Agent does NOT have web_search → block grounding
                            toolResult = { 
                                error: 'NO tenés acceso a búsqueda web. Respondé SOLO con la información de las herramientas disponibles (knowledge_base, etc). NO busques en internet.'
                            }
                            error = 'Google Search not authorized for this agent'
                            console.warn(`[NativeGeminiV2] Blocked google_search grounding — agent lacks web_search tool`)
                        }
                    } else if (name === 'odoo_intelligent_query') {
                        toolResult = { 
                            error: `La tool "odoo_intelligent_query" fue reemplazada. Usá: ` +
                                   `get_sales_total, get_invoices_by_customer, get_debt_by_customer, etc.`
                        }
                        error = `Tool ${name} not found`
                    } else {
                        toolResult = { error: `Tool ${name} no está disponible.` }
                        error = `Tool ${name} not found`
                    }
                } else {
                    try {
                        toolResult = await tool.execute(args)
                    } catch (execError: any) {
                        console.error(`[NativeGeminiV2] Tool ${name} error:`, execError)
                        toolResult = { error: execError.message || 'Tool execution failed' }
                        error = execError.message
                    }
                }
                
                const durationMs = Date.now() - startTime
                
                // Emit thinking step: done or error (skip for blocked google_search)
                if (onThinkingStep && !isBlockedGoogleSearch) {
                    onThinkingStep({
                        tool: name,
                        source,
                        status: error ? 'error' : 'done',
                        duration: durationMs,
                        error,
                        startedAt: startTime
                    })
                }
                
                toolCalls.push({
                    toolName: name,
                    args,
                    result: toolResult,
                    durationMs,
                    error
                })

                functionResponses.push({
                    functionResponse: {
                        name,
                        response: toolResult
                    }
                })
            }

            // Add function responses to conversation and continue
            contents.push({
                role: 'model',
                parts: functionCallParts
            })
            contents.push({
                role: 'user',
                parts: functionResponses
            })

            // Continue the conversation - with retry for transient errors
            response = await withRetry(
                () => client.models.generateContent({
                    model: modelName,
                    contents,
                    config: {
                        systemInstruction: system,
                        maxOutputTokens: 4096,
                        tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
                        thinkingConfig
                    }
                }),
                {
                    maxAttempts: 3,
                    initialDelayMs: 1000,
                    maxDelayMs: 8000,
                    onRetry: (attempt, error) => {
                        console.log(`[NativeGeminiV2] Retry ${attempt}/3 after error:`, (error as Error).message?.slice(0, 100))
                    }
                }
            )

            // Update usage
            if (response.usageMetadata) {
                totalTokens += response.usageMetadata.totalTokenCount || 0
                thinkingTokens += response.usageMetadata.thoughtsTokenCount || 0
            }

            // If this is the last step, force a text-only response
            if (step === maxSteps - 1) {
                console.log(`[NativeGeminiV2] Reached maxSteps (${maxSteps}), forcing text response`)
                const finalParts = response.candidates?.[0]?.content?.parts || []
                
                for (const part of finalParts) {
                    if (part.thought && part.text) {
                        thinkingSummary += part.text
                        if (onThinkingSummary) onThinkingSummary(part.text)
                    }
                    if (!part.thought && part.text) finalText += part.text
                }
                
                // If model wanted more tools instead of answering, force one final text-only call
                if (!finalText.trim()) {
                    console.log(`[NativeGeminiV2] No text yet, making force-text call (mode: NONE)`)
                    // Inject synthesis instruction so the model knows to answer with accumulated data
                    contents.push({
                        role: 'user',
                        parts: [{ text: 'Ya tenés toda la información que necesitás de las herramientas anteriores. Respondé la pregunta original del usuario con esos datos. Sé directo y conciso. Si no tenés datos suficientes, explicá qué falta.' }]
                    })
                    const forceResponse = await withRetry(
                        () => client.models.generateContent({
                            model: modelName,
                            contents,
                            config: {
                                systemInstruction: system,
                                maxOutputTokens: 4096,
                                toolConfig: { functionCallingConfig: { mode: 'NONE' as any } },
                                thinkingConfig
                            }
                        }),
                        { maxAttempts: 2, initialDelayMs: 1000, maxDelayMs: 4000 }
                    )
                    const forceParts = forceResponse.candidates?.[0]?.content?.parts || []
                    for (const part of forceParts) {
                        if (!part.thought && part.text) finalText += part.text
                    }
                    if (forceResponse.usageMetadata) {
                        totalTokens += forceResponse.usageMetadata.totalTokenCount || 0
                    }
                }

                // Final safety net: if still no text after force-text, provide fallback
                if (!finalText.trim()) {
                    console.warn(`[NativeGeminiV2] Force-text call returned empty, using fallback`)
                    finalText = 'Perdón, busqué mucha información pero no logré armar una respuesta. ¿Podés reformular la pregunta o ser más específico?'
                }
            }
            // Otherwise, the next loop iteration will handle the response
        }

        // Detect and truncate repetition loops
        finalText = truncateRepetitionLoop(finalText)

        return {
            text: finalText,
            thinkingSummary: thinkingSummary || undefined,
            usage: { totalTokens, thinkingTokens },
            toolCalls
        }

    } catch (error: any) {
        console.error('[NativeGeminiV2] Error:', error)
        
        if (error.status === 404 || error.message?.includes('not found')) {
            throw new Error('El modelo de IA no está disponible momentáneamente. Intentá de nuevo.')
        } else if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('rate')) {
            throw new Error('Demasiadas consultas. Esperá unos segundos e intentá de nuevo.')
        } else if (error.status === 503 || error.message?.includes('overloaded')) {
            throw new Error('El servicio de IA está sobrecargado. Intentá en unos minutos.')
        }
        throw error
    }
}
