/**
 * DateService - Single Source of Truth para fechas
 *
 * Centraliza la obtención de fechas en toda la aplicación para:
 * - Consistencia: Una sola fecha "actual" en toda la app
 * - Testabilidad: Poder mockear fechas para tests
 * - Mantenibilidad: Un solo lugar para cambiar timezone/formato
 *
 * @example
 * // Uso normal
 * const now = DateService.now()
 * const formatted = DateService.formatted()
 *
 * // Para tests
 * DateService.setOverride(new Date('2026-01-09'))
 * // ... run tests ...
 * DateService.clearOverride()
 */

export class DateService {
  private static override: Date | null = null

  /**
   * Obtiene la fecha actual (o la fecha override si está configurada)
   */
  static now(): Date {
    return this.override || new Date()
  }

  /**
   * Retorna fecha formateada en español argentino
   * Ejemplo: "jueves, 9 de enero de 2026"
   */
  static formatted(): string {
    return this.now().toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  /**
   * Retorna fecha en formato ISO (YYYY-MM-DD)
   * Ejemplo: "2026-01-09"
   */
  static isoDate(): string {
    return this.now().toISOString().split('T')[0]
  }

  /**
   * Retorna mes actual en formato YYYY-MM
   * Ejemplo: "2026-01"
   */
  static currentMonth(): string {
    return this.now().toISOString().slice(0, 7)
  }

  /**
   * Retorna año actual
   */
  static currentYear(): number {
    return this.now().getFullYear()
  }

  /**
   * Configura una fecha override (para tests o debugging)
   * @param date Fecha a usar como "ahora"
   */
  static setOverride(date: Date): void {
    this.override = date
  }

  /**
   * Limpia el override y vuelve a usar fecha real
   */
  static clearOverride(): void {
    this.override = null
  }

  /**
   * Verifica si hay un override activo
   */
  static isOverridden(): boolean {
    return this.override !== null
  }
}
