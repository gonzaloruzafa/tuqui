/**
 * ResponseFormatter - Formateo limpio y consistente para WhatsApp y Web
 *
 * Problema: Markdown complejo se rompe en WhatsApp
 * Solución: Formateo minimalista que funciona en ambos canales
 *
 * Principios:
 * - Usar * solo para negritas (no ** ni _)
 * - Un emoji por sección máximo
 * - Sin tablas markdown (usar listas)
 * - Sin headers ### (usar texto en negrita)
 * - Links cortos y descriptivos
 */

export interface FormattingOptions {
  channel: 'whatsapp' | 'web'
  maxLineLength?: number
  useEmojis?: boolean
  useBold?: boolean
}

export class ResponseFormatter {
  /**
   * Formatea una respuesta para el canal especificado
   */
  static format(text: string, options: FormattingOptions): string {
    const { channel = 'whatsapp', maxLineLength = 80, useEmojis = true, useBold = true } = options

    let formatted = text

    // 1. Limpiar markdown complejo
    formatted = this.cleanMarkdown(formatted, useBold)

    // 2. Reducir emojis excesivos
    if (!useEmojis) {
      formatted = this.removeEmojis(formatted)
    } else {
      formatted = this.reduceEmojis(formatted)
    }

    // 3. Convertir tablas a listas
    formatted = this.tablesToLists(formatted)

    // 4. Simplificar headers
    formatted = this.simplifyHeaders(formatted)

    // 5. Acortar links si es WhatsApp
    if (channel === 'whatsapp') {
      formatted = this.shortenLinks(formatted)
    }

    // 6. Wrap lines largas
    formatted = this.wrapLines(formatted, maxLineLength)

    return formatted.trim()
  }

  /**
   * Limpia markdown complejo dejando solo básicos
   */
  private static cleanMarkdown(text: string, keepBold: boolean): string {
    let clean = text

    // Convertir ** a * (WhatsApp entiende * mejor)
    clean = clean.replace(/\*\*([^*]+)\*\*/g, keepBold ? '*$1*' : '$1')

    // Remover _ para itálicas (confunde en WhatsApp)
    clean = clean.replace(/_([^_]+)_/g, '$1')

    // Remover ~~tachado~~ (no funciona en WhatsApp)
    clean = clean.replace(/~~([^~]+)~~/g, '$1')

    // Remover backticks ` (no se ven bien en WhatsApp)
    clean = clean.replace(/`([^`]+)`/g, '$1')

    return clean
  }

  /**
   * Reduce emojis a uno por sección máximo
   */
  private static reduceEmojis(text: string): string {
    // Encontrar líneas con múltiples emojis
    const lines = text.split('\n')
    const cleaned = lines.map((line) => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
      const emojis = line.match(emojiRegex) || []

      // Si tiene más de 2 emojis, quedarse solo con el primero
      if (emojis.length > 2) {
        const firstEmoji = emojis[0]
        let cleaned = line
        emojis.slice(1).forEach((emoji) => {
          cleaned = cleaned.replace(emoji, '')
        })
        return cleaned
      }

      return line
    })

    return cleaned.join('\n')
  }

  /**
   * Remueve todos los emojis
   */
  private static removeEmojis(text: string): string {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
    return text.replace(emojiRegex, '').replace(/\s+/g, ' ')
  }

  /**
   * Convierte tablas markdown a listas simples
   */
  private static tablesToLists(text: string): string {
    // Detectar tablas markdown (líneas con |)
    const lines = text.split('\n')
    const result: string[] = []
    let inTable = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Detectar inicio de tabla
      if (line.includes('|') && !inTable) {
        inTable = true
        continue // Skip header row
      }

      // Detectar separador de tabla (---)
      if (inTable && line.includes('---')) {
        continue
      }

      // Procesar fila de tabla
      if (inTable && line.includes('|')) {
        const cells = line
          .split('|')
          .map((c) => c.trim())
          .filter((c) => c.length > 0)

        if (cells.length > 0) {
          // Convertir a lista: Primera celda en negrita, resto normal
          result.push(`• *${cells[0]}*: ${cells.slice(1).join(' - ')}`)
        }
      } else {
        // Fin de tabla
        if (inTable) {
          inTable = false
        }
        result.push(line)
      }
    }

    return result.join('\n')
  }

  /**
   * Simplifica headers (### → texto en negrita)
   */
  private static simplifyHeaders(text: string): string {
    let simple = text

    // ### Header → *Header*
    simple = simple.replace(/^#{1,6}\s+(.+)$/gm, '\n*$1*\n')

    return simple
  }

  /**
   * Acorta links para WhatsApp
   */
  private static shortenLinks(text: string): string {
    // [Texto muy largo](url) → [Link](url)
    const linkRegex = /\[([^\]]{30,})\]\(([^)]+)\)/g
    return text.replace(linkRegex, '[Link]($2)')
  }

  /**
   * Wrap líneas largas
   */
  private static wrapLines(text: string, maxLength: number): string {
    const lines = text.split('\n')
    const wrapped: string[] = []

    for (const line of lines) {
      if (line.length <= maxLength) {
        wrapped.push(line)
        continue
      }

      // Wrap línea larga
      const words = line.split(' ')
      let current = ''

      for (const word of words) {
        if ((current + ' ' + word).length <= maxLength) {
          current += (current ? ' ' : '') + word
        } else {
          if (current) wrapped.push(current)
          current = word
        }
      }

      if (current) wrapped.push(current)
    }

    return wrapped.join('\n')
  }

  /**
   * Formatea un precio con el formato correcto según canal
   */
  static formatPrice(amount: number, channel: 'whatsapp' | 'web' = 'whatsapp'): string {
    if (channel === 'whatsapp') {
      // WhatsApp: formato simple sin símbolo especial
      return `$ ${amount.toLocaleString('es-AR')}`
    } else {
      // Web: formato completo
      return `$ ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    }
  }

  /**
   * Formatea una lista de items
   */
  static formatList(items: string[], numbered: boolean = false): string {
    return items.map((item, i) => (numbered ? `${i + 1}. ${item}` : `• ${item}`)).join('\n')
  }

  /**
   * Formatea un ranking/top N
   */
  static formatRanking(
    items: Array<{ name: string; value: number | string }>,
    options?: { showPosition?: boolean; maxItems?: number }
  ): string {
    const { showPosition = true, maxItems = 10 } = options || {}
    const limited = items.slice(0, maxItems)

    return limited
      .map((item, i) => {
        const position = showPosition ? `${i + 1}. ` : '• '
        return `${position}*${item.name}* - ${item.value}`
      })
      .join('\n')
  }

  /**
   * Formatea una comparación (precio propio vs mercado)
   */
  static formatComparison(data: {
    ownPrice: number
    marketAvg: number
    difference: number
  }): string {
    const { ownPrice, marketAvg, difference } = data
    const symbol = difference > 0 ? '▲' : '▼'
    const absPercent = Math.abs(difference).toFixed(1)

    return `
Tu precio: ${this.formatPrice(ownPrice)}
Mercado: ${this.formatPrice(marketAvg)}
${symbol} ${absPercent}% ${difference > 0 ? 'arriba' : 'abajo'} del promedio
    `.trim()
  }
}

/**
 * Helper: Detectar canal desde el contexto de la request
 */
export function detectChannel(request: Request): 'whatsapp' | 'web' {
  const userAgent = request.headers.get('user-agent') || ''
  const referer = request.headers.get('referer') || ''

  // WhatsApp tiene user-agent específico
  if (userAgent.includes('WhatsApp')) {
    return 'whatsapp'
  }

  // Si viene del endpoint de WhatsApp
  if (referer.includes('/whatsapp')) {
    return 'whatsapp'
  }

  return 'web'
}
