/**
 * Parse @mention from chat message.
 * 
 * USAR CUANDO: el usuario escribe "@contador qué dice la ley de IVA"
 * → parsea el slug, retorna el mensaje limpio sin el @mention.
 * Si el slug no existe en la lista de disponibles, se ignora.
 */

const MENTION_REGEX = /^@([a-z][a-z0-9_-]{0,48})\s+/

export interface MentionResult {
    /** Agent slug si se detectó un @mention válido, null si no */
    agentSlug: string | null
    /** Mensaje sin el @mention */
    cleanMessage: string
}

export function parseMention(message: string, availableSlugs: string[]): MentionResult {
    const match = message.match(MENTION_REGEX)

    if (!match) return { agentSlug: null, cleanMessage: message }

    const slug = match[1]
    if (!availableSlugs.includes(slug)) {
        return { agentSlug: null, cleanMessage: message }
    }

    return {
        agentSlug: slug,
        cleanMessage: message.slice(match[0].length).trim(),
    }
}
