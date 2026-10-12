export const CEDULA_NACIONAL = /^([1-9])-?(\d{4})-?(\d{4})$/;
export const CEDULA_DIMEX = /^\d{11,12}$/;

/**
 * Normaliza una cédula de identidad:
 * - Elimina espacios en blanco iniciales, finales e intermedios.
 * - Si corresponde a una cédula física costarricense (9 dígitos con o sin guiones),
 *   la convierte al formato canónico estándar `1-1234-0567`.
 * - Para otros formatos válidos (DIMEX, extranjera, pasaporte), devuelve el valor
 *   limpio sin espacios para evitar duplicidades por variaciones de espaciado.
 */
export const normalizarCedula = (valor: string): string => {
  if (!valor || typeof valor !== 'string') {
    return valor as string;
  }

  const limpio = valor.trim().replace(/\s+/g, '');
  const nacional = CEDULA_NACIONAL.exec(limpio);
  if (nacional) {
    return `${nacional[1]}-${nacional[2]}-${nacional[3]}`;
  }

  return limpio;
};
