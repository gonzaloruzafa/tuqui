/**
 * ResponseGuard - Validación estructural de respuestas del LLM
 *
 * Detecta y previene alucinaciones comunes:
 * - Nombres genéricos ficticios (Laura Gómez, Carlos Pérez)
 * - Placeholders (Producto A, Cliente 1)
 * - Datos sin fuente verificable
 * - Formatos de datos sospechosos
 *
 * @example
 * const warning = ResponseGuard.detectHallucination(text)
 * if (warning) {
 *   console.warn('Posible alucinación detectada:', warning)
 * }
 */

// ============================================
// TYPES
// ============================================

export interface HallucinationWarning {
  type: 'potential_hallucination' | 'missing_source' | 'suspicious_format'
  pattern: string
  suggestion: string
  severity: 'low' | 'medium' | 'high'
  location?: string
}

export interface ValidationResult {
  valid: boolean
  warnings: HallucinationWarning[]
  score: number // 0-100, donde 100 es totalmente confiable
}

// ============================================
// SUSPECT PATTERNS
// ============================================

/**
 * Nombres genéricos en español que el LLM suele inventar
 */
const GENERIC_SPANISH_NAMES = [
  /Laura\s+Gómez/i,
  /Carlos\s+Pérez/i,
  /María\s+Rodríguez/i,
  /Jorge\s+López/i,
  /Ana\s+Martínez/i,
  /Juan\s+García/i,
  /Pedro\s+González/i,
  /Sofía\s+Fernández/i,
  /Diego\s+Torres/i,
  /Valentina\s+Ramírez/i,
]

/**
 * Placeholders comunes
 */
const PLACEHOLDER_PATTERNS = [
  /Producto\s+[ABC123]/i,
  /Cliente\s+[ABC123]/i,
  /Vendedor\s+[ABC123]/i,
  /Item\s+[ABC123]/i,
  /\[NOMBRE\]/i,
  /\[DATO\]/i,
  /\[TBD\]/i,
  /XXX/,
  /TODO:/i,
]

/**
 * Formatos numéricos sospechosos
 */
const SUSPICIOUS_NUMBER_FORMATS = [
  /\$\s*\d+\.\d{3}\.\d{3},\d{2}/, // Formato extraño: $1.234.567,89
  /\d{10,}/, // Números demasiado largos sin separadores
]

/**
 * Frases que indican invención
 */
const INVENTION_PHRASES = [
  /supongamos\s+que/i,
  /podríamos\s+asumir/i,
  /por\s+ejemplo,?\s+digamos/i,
  /imaginemos\s+que/i,
  /si\s+asumimos/i,
]

// ============================================
// MAIN GUARD CLASS
// ============================================

export class ResponseGuard {
  /**
   * Detecta posibles alucinaciones en el texto generado
   */
  static detectHallucination(text: string): HallucinationWarning | null {
    // Check generic names
    for (const pattern of GENERIC_SPANISH_NAMES) {
      if (pattern.test(text)) {
        return {
          type: 'potential_hallucination',
          pattern: pattern.source,
          suggestion: 'Verificar que este nombre exista en los datos reales de Odoo',
          severity: 'high',
        }
      }
    }

    // Check placeholders
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(text)) {
        return {
          type: 'potential_hallucination',
          pattern: pattern.source,
          suggestion: 'Este parece ser un placeholder genérico, no un dato real',
          severity: 'high',
        }
      }
    }

    // Check invention phrases
    for (const pattern of INVENTION_PHRASES) {
      if (pattern.test(text)) {
        return {
          type: 'potential_hallucination',
          pattern: pattern.source,
          suggestion: 'El LLM está asumiendo o inventando, no usando datos reales',
          severity: 'medium',
        }
      }
    }

    // Check suspicious formats
    for (const pattern of SUSPICIOUS_NUMBER_FORMATS) {
      if (pattern.test(text)) {
        return {
          type: 'suspicious_format',
          pattern: pattern.source,
          suggestion: 'Formato numérico poco usual, verificar si es real',
          severity: 'low',
        }
      }
    }

    return null
  }

  /**
   * Valida que métricas numéricas tengan sources válidos
   */
  static validateMetrics(
    metrics: Record<string, number>,
    sources: string[]
  ): ValidationResult {
    const warnings: HallucinationWarning[] = []

    // Check if sources exist
    if (sources.length === 0) {
      warnings.push({
        type: 'missing_source',
        pattern: 'no_sources',
        suggestion: 'Métricas sin fuente verificable',
        severity: 'high',
      })
    }

    // Check if sources are valid
    const validSources = sources.every(
      (s) =>
        s.startsWith('odoo:') ||
        s.startsWith('meli:') ||
        s.startsWith('calculated:') ||
        s.startsWith('cache:')
    )

    if (!validSources) {
      warnings.push({
        type: 'missing_source',
        pattern: 'invalid_source_format',
        suggestion: 'Sources deben tener formato: odoo:model, meli:search, calculated:formula',
        severity: 'medium',
      })
    }

    // Calculate confidence score
    const score = warnings.length === 0 ? 100 : Math.max(0, 100 - warnings.length * 30)

    return {
      valid: warnings.length === 0,
      warnings,
      score,
    }
  }

  /**
   * Valida una respuesta completa del LLM
   */
  static validateResponse(text: string, metadata?: {
    sources?: string[]
    metrics?: Record<string, number>
  }): ValidationResult {
    const warnings: HallucinationWarning[] = []

    // Check for hallucinations in text
    const hallucination = this.detectHallucination(text)
    if (hallucination) {
      warnings.push(hallucination)
    }

    // Validate metrics if provided
    if (metadata?.metrics && metadata?.sources) {
      const metricValidation = this.validateMetrics(metadata.metrics, metadata.sources)
      warnings.push(...metricValidation.warnings)
    }

    // Calculate overall score
    let score = 100
    for (const warning of warnings) {
      if (warning.severity === 'high') score -= 40
      else if (warning.severity === 'medium') score -= 20
      else score -= 10
    }
    score = Math.max(0, score)

    return {
      valid: warnings.length === 0 && score >= 70,
      warnings,
      score,
    }
  }

  /**
   * Sanitiza una respuesta, removiendo o marcando contenido sospechoso
   */
  static sanitize(text: string): string {
    let sanitized = text

    // Replace generic names with warnings
    for (const pattern of GENERIC_SPANISH_NAMES) {
      sanitized = sanitized.replace(
        pattern,
        (match) => `${match} [⚠️ Verificar: nombre genérico]`
      )
    }

    // Replace placeholders with warnings
    for (const pattern of PLACEHOLDER_PATTERNS) {
      sanitized = sanitized.replace(
        pattern,
        (match) => `${match} [⚠️ Placeholder detectado]`
      )
    }

    return sanitized
  }

  /**
   * Helper: Extrae nombres de personas del texto
   */
  static extractNames(text: string): string[] {
    // Simple pattern: Capital letter followed by lowercase, then Capital letter
    const namePattern = /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/g
    const matches = text.match(namePattern) || []
    return [...new Set(matches)] // unique names
  }

  /**
   * Helper: Verifica si un nombre es genérico/común
   */
  static isGenericName(name: string): boolean {
    return GENERIC_SPANISH_NAMES.some((pattern) => pattern.test(name))
  }
}
