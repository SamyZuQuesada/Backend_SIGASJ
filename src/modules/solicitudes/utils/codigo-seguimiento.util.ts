import { randomInt } from 'crypto';

/**
 * Alfabeto seguro para códigos de seguimiento ciudadanos.
 * Contiene dígitos (0-9) y letras mayúsculas (A-Z) para un total de 36 caracteres.
 * Con 6 caracteres, produce más de 2.17 mil millones de combinaciones posibles por año.
 */
export const CODIGO_SEGUIMIENTO_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Expresión regular que valida el formato oficial de código de seguimiento público:
 * Formato estándar: SOL-YYYY-XXXXXX (ej: SOL-2026-A82K91).
 * Admite de 5 a 10 caracteres alfanuméricos en el token para compatibilidad total.
 */
export const CODIGO_SEGUIMIENTO_REGEX = /^SOL-\d{4}-[A-Z0-9]{5,10}$/i;

/**
 * Genera un token alfanumérico seguro y no predecible utilizando entropía criptográfica.
 *
 * @param longitud Longitud del token deseado (por defecto 6 caracteres).
 */
export function generarTokenAlfanumerico(longitud = 6): string {
  let token = '';
  const totalChars = CODIGO_SEGUIMIENTO_CHARS.length;
  for (let i = 0; i < longitud; i++) {
    const randomIndex = randomInt(0, totalChars);
    token += CODIGO_SEGUIMIENTO_CHARS.charAt(randomIndex);
  }
  return token;
}

/**
 * Formatea un código de seguimiento con el formato oficial del sistema:
 * SOL-{AÑO}-{TOKEN} (ej: SOL-2026-A82K91).
 *
 * @param year Año opcional (por defecto el año en curso).
 * @param token Token alfanumérico opcional (si no se especifica, se genera aleatoriamente).
 */
export function formatearCodigoSeguimiento(
  year?: number,
  token?: string,
): string {
  const anio = year || new Date().getFullYear();
  const sufijo = (token || generarTokenAlfanumerico(6)).trim().toUpperCase();
  return `SOL-${anio}-${sufijo}`;
}

/**
 * Normaliza un código de seguimiento eliminando espacios en blanco y convirtiendo a mayúsculas.
 */
export function normalizarCodigoSeguimiento(codigo: string): string {
  if (!codigo || typeof codigo !== 'string') {
    return '';
  }
  return codigo.trim().toUpperCase();
}

/**
 * Valida si una cadena cumple con el formato oficial de código de seguimiento de solicitudes.
 */
export function validarFormatoCodigoSeguimiento(codigo: string): boolean {
  const normalizado = normalizarCodigoSeguimiento(codigo);
  return CODIGO_SEGUIMIENTO_REGEX.test(normalizado);
}
