import { auth } from '@/lib/auth/config'
import { getAgentBySlug } from '@/lib/agents/service'
import { processChatRequest } from '@/lib/chat/engine'

export const maxDuration = 120 // Plan Pro - longer timeout for multi-tool calls

export async function POST(req: Request) {
    const session = await auth()

    if (!session?.user?.email || !session.tenant?.id) {
        return new Response('Unauthorized', { status: 401 })
    }

    let body: any
    try {
        body = await req.json()
    } catch (e) {
        console.error('Failed to parse request body:', e)
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
    }

    const { agentSlug, messages, sessionId, voiceMode } = body
    const tenantId = session.tenant.id

    console.log('[Chat] Request:', { agentSlug, sessionId, messagesCount: messages?.length })

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        console.error('[Chat] Invalid messages:', messages)
        return new Response(JSON.stringify({ error: 'Messages array is required' }), { status: 400 })
    }

    try {
        // Get full agent config from DB
        const agent = await getAgentBySlug(tenantId, agentSlug)
        if (!agent) {
            return new Response('Agent not found', { status: 404 })
        }

        const channel = voiceMode ? 'voice' as const : 'web' as const

        // Voice mode: return plain text (no streaming, simpler client)
        if (voiceMode) {
            try {
                const result = await processChatRequest({
                    tenantId,
                    userEmail: session.user.email!,
                    userId: session.user.id,
                    agent,
                    messages,
                    channel: 'voice'
                })
                return new Response(result.text)
            } catch (voiceError: any) {
                console.error('[Chat] VoiceMode error:', voiceError)
                return new Response(JSON.stringify({
                    error: 'Voice generation failed',
                    details: voiceError.message
                }), { status: 500 })
            }
        }

        // Web mode: streaming with thinking events
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const result = await processChatRequest({
                        tenantId,
                        userEmail: session.user.email!,
                        userId: session.user.id,
                        agent,
                        messages,
                        channel: 'web',
                        streaming: true,
                        onThinkingStep: (step) => {
                            const event = `t:${JSON.stringify(step)}\n`
                            controller.enqueue(encoder.encode(event))
                        },
                        onThinkingSummary: (summary) => {
                            const event = `th:${JSON.stringify({ text: summary })}\n`
                            controller.enqueue(encoder.encode(event))
                        }
                    })

                    controller.enqueue(encoder.encode(result.text))
                    controller.close()
                } catch (error: any) {
                    console.error('[Chat] Streaming error:', error)
                    controller.error(error)
                }
            }
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Content-Type-Options': 'nosniff'
            }
        })

    } catch (error: any) {
        console.error('Chat error:', error)

        const { getFriendlyError, formatErrorResponse } = await import('@/lib/errors/friendly-messages')
        const friendlyError = getFriendlyError(error)
        const response = formatErrorResponse(error)

        return new Response(JSON.stringify(response), { status: friendlyError.statusCode })
    }
}
