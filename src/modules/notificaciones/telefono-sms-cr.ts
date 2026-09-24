/**
 * Normaliza teléfonos de Costa Rica a dígitos internacionales (506XXXXXXXX).
 * No muta Averia.telefonoReportante; solo se usa en el envío.
 */
export function normalizarTelefonoSmsCr(
  valor: string | undefined | null,
): string | null {
  if (!valor) {
    return null;
  }
  let digitos = valor.trim();
  if (digitos.startsWith('+')) {
    digitos = digitos.slice(1);
  }
  digitos = digitos.replace(/\D/g, '');
  if (digitos.startsWith('00')) {
    digitos = digitos.slice(2);
  }
  if (digitos.length === 8) {
    digitos = `506${digitos}`;
  }
  if (!/^506\d{8}$/.test(digitos)) {
    return null;
  }
  return digitos;
}
