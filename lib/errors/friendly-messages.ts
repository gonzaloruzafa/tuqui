/**
 * Friendly Error Messages
 *
 * Translates technical errors into user-friendly Spanish messages
 */

export interface FriendlyError {
  message: string;
  suggestion: string;
  retryable: boolean;
  statusCode: number;
}

/**
 * Convert technical error to friendly user message
 */
export function getFriendlyError(error: any): FriendlyError {
  const errorMessage = error?.message || error?.toString() || '';
  const errorLower = errorMessage.toLowerCase();

  // Token Limits
  if (errorLower.includes('monthly token limit') || errorLower.includes('quota exceeded')) {
    const match = errorMessage.match(/(\d+)\/(\d+)/);
    const usage = match ? `Has usado ${match[1]} de ${match[2]} tokens este mes.` : '';

    return {
      message: '⚠️ Límite mensual de tokens alcanzado',
      suggestion: `${usage} Por favor, contactá al administrador para aumentar tu límite o esperá hasta el próximo ciclo de facturación.`,
      retryable: false,
      statusCode: 429,
    };
  }

  if (errorLower.includes('rate limit') || errorLower.includes('too many requests')) {
    return {
      message: '🕒 Demasiadas consultas',
      suggestion: 'Esperá unos segundos antes de volver a intentar. Estamos procesando muchas consultas en este momento.',
      retryable: true,
      statusCode: 429,
    };
  }

  if (errorLower.includes('resource_exhausted') || errorLower.includes('quota')) {
    return {
      message: '📊 Cuota de API agotada',
      suggestion: 'El servicio alcanzó su límite de uso. Contactá al administrador para revisar los límites de API.',
      retryable: false,
      statusCode: 429,
    };
  }

  // Authentication Errors
  if (errorLower.includes('authentication') || errorLower.includes('unauthorized') || errorLower.includes('invalid api key')) {
    return {
      message: '🔒 Error de autenticación',
      suggestion: 'La clave de API es inválida o expiró. Contactá al administrador para verificar las credenciales.',
      retryable: false,
      statusCode: 401,
    };
  }

  // Network Errors
  if (errorLower.includes('network') || errorLower.includes('econnrefused') || errorLower.includes('fetch failed')) {
    return {
      message: '🌐 Error de conexión',
      suggestion: 'No se pudo conectar al servidor. Verificá tu conexión a internet e intentá nuevamente.',
      retryable: true,
      statusCode: 503,
    };
  }

  if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
    return {
      message: '⏱️ Tiempo de espera agotado',
      suggestion: 'La consulta tardó demasiado. Intentá con una pregunta más simple o volvé a intentar.',
      retryable: true,
      statusCode: 504,
    };
  }

  // Odoo Specific Errors
  if (errorLower.includes('odoo') && errorLower.includes('❌')) {
    // Already has friendly message from Odoo client
    return {
      message: errorMessage,
      suggestion: '',
      retryable: false,
      statusCode: 500,
    };
  }

  // Model/AI Errors
  if (errorLower.includes('model') && (errorLower.includes('not found') || errorLower.includes('unavailable'))) {
    return {
      message: '🤖 Modelo no disponible',
      suggestion: 'El modelo de IA no está disponible temporalmente. Intentá más tarde o contactá al administrador.',
      retryable: true,
      statusCode: 503,
    };
  }

  if (errorLower.includes('content filter') || errorLower.includes('safety')) {
    return {
      message: '⚠️ Contenido bloqueado',
      suggestion: 'Tu mensaje fue bloqueado por filtros de seguridad. Reformulá tu pregunta de otra manera.',
      retryable: true,
      statusCode: 400,
    };
  }

  // Validation Errors
  if (errorLower.includes('validation') || errorLower.includes('invalid input')) {
    return {
      message: '❌ Entrada inválida',
      suggestion: 'Los datos enviados no son válidos. Revisá tu consulta e intentá nuevamente.',
      retryable: true,
      statusCode: 400,
    };
  }

  // Database Errors
  if (errorLower.includes('database') || errorLower.includes('sql')) {
    return {
      message: '💾 Error de base de datos',
      suggestion: 'Hubo un problema accediendo a los datos. Si el problema persiste, contactá al soporte.',
      retryable: false,
      statusCode: 500,
    };
  }

  // Generic 500 errors
  if (errorLower.includes('internal server error') || errorLower.includes('500')) {
    return {
      message: '⚠️ Error del servidor',
      suggestion: 'Ocurrió un error inesperado. Intentá nuevamente y si el problema persiste, contactá al soporte.',
      retryable: true,
      statusCode: 500,
    };
  }

  // Default fallback
  return {
    message: '❌ Error inesperado',
    suggestion: errorMessage || 'Ocurrió un error. Intentá nuevamente o contactá al soporte si el problema persiste.',
    retryable: true,
    statusCode: 500,
  };
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: any): { error: string; suggestion?: string; retryable?: boolean } {
  const friendly = getFriendlyError(error);

  return {
    error: friendly.message,
    suggestion: friendly.suggestion,
    retryable: friendly.retryable,
  };
}

/**
 * Format error for user display (includes suggestion)
 */
export function formatErrorForUser(error: any): string {
  const friendly = getFriendlyError(error);

  if (friendly.suggestion) {
    return `${friendly.message}\n\n${friendly.suggestion}`;
  }

  return friendly.message;
}
