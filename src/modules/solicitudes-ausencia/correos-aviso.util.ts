export const MAX_CORREOS_AVISO = 5;
export const MAX_CORREOS_AVISO_LENGTH = 500;

const CORREO_AVISO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export const esCorreoAvisoValido = (value: string): boolean =>
  CORREO_AVISO_RE.test(value.trim());

/** Separa por coma, punto y coma o espacio. Conserva el orden y quita duplicados. */
export const parseCorreosAviso = (value: string): string[] => {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const parte of value.split(/[,;\s]+/)) {
    const correo = parte.trim().toLowerCase();
    if (!correo || vistos.has(correo)) {
      continue;
    }
    vistos.add(correo);
    resultado.push(correo);
  }
  return resultado;
};

export const normalizarCorreosAviso = (value: string): string =>
  parseCorreosAviso(value).join(', ');

export const validarListaCorreosAviso = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Indique al menos un correo donde desea recibir el aviso.';
  }
  const lista = parseCorreosAviso(value);
  if (!lista.length) {
    return 'Indique al menos un correo donde desea recibir el aviso.';
  }
  if (lista.length > MAX_CORREOS_AVISO) {
    return `Puede indicar hasta ${MAX_CORREOS_AVISO} correos de aviso.`;
  }
  for (const correo of lista) {
    if (!esCorreoAvisoValido(correo)) {
      return `El correo electrónico no es válido: ${correo}`;
    }
  }
  if (lista.join(', ').length > MAX_CORREOS_AVISO_LENGTH) {
    return 'Los correos de aviso no pueden superar 500 caracteres.';
  }
  return null;
};
