/**
 * Genera un slug URL-friendly a partir de un nombre.
 * Normaliza acentos, reemplaza espacios/especiales por guiones.
 *
 * @example generateSlug('Empresa ABC') → 'empresa-abc'
 * @example generateSlug('Café & Más') → 'cafe-mas'
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
