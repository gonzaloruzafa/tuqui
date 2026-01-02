import { getTenantClient } from './tenant'
import { getMasterClient } from './master'

export interface Message {
    role: 'user' | 'assistant'
    content: string
}

export async function getOrCreateWhatsAppSession(tenantId: string, agentId: string, userEmail: string) {
    const db = await getTenantClient(tenantId)

    // Find last active session for this agent and user
    const { data: session, error } = await db
        .from('chat_sessions')
        .select('id')
        .eq('agent_id', agentId)
        .eq('user_email', userEmail)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

    if (session) return session.id

    // Create new session
    const { data: newSession, error: createError } = await db
        .from('chat_sessions')
        .insert({
            agent_id: agentId,
            user_email: userEmail,
            title: 'WhatsApp Conversation'
        })
        .select('id')
        .single()

    if (createError || !newSession) {
        console.error('[ChatHistory] Error creating session:', createError)
        throw new Error('Failed to create chat session')
    }

    return newSession.id
}

export async function getSessionMessages(tenantId: string, sessionId: string, limit = 20): Promise<Message[]> {
    const db = await getTenantClient(tenantId)
    const { data: messages, error } = await db
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(limit)

    if (error) {
        console.error('[ChatHistory] Error fetching messages:', error)
        return []
    }

    return messages as Message[]
}

export async function saveMessage(tenantId: string, sessionId: string, role: 'user' | 'assistant', content: string) {
    const db = await getTenantClient(tenantId)

    // Save message
    const { error: msgError } = await db
        .from('chat_messages')
        .insert({
            session_id: sessionId,
            role,
            content
        })

    // Update session timestamp
    await db
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId)

    if (msgError) {
        console.error('[ChatHistory] Error saving message:', msgError)
    }
}
