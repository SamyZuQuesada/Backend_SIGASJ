import { QueryFailedError } from 'typeorm';

export const CODIGO_SEGUIMIENTO_MAX_RETRIES = 5;

export function buildCodigoSeguimiento(
  year: number,
  consecutive: number,
): string {
  return `AV-${year}-${String(consecutive).padStart(4, '0')}`;
}

export function parseConsecutiveFromCodigo(
  codigo: string,
  year: number,
): number | null {
  const match = new RegExp(`^AV-${year}-(\\d+)$`).exec(codigo);
  if (!match?.[1]) {
    return null;
  }
  const consecutive = Number.parseInt(match[1], 10);
  return Number.isInteger(consecutive) && consecutive > 0 ? consecutive : null;
}

/**
 * Detecta únicamente violaciones UNIQUE al persistir codigoSeguimiento.
 * No trata timeouts, FK ni errores de esquema como colisión de código.
 */
export function isCodigoSeguimientoUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driver = error.driverError as
    | {
        number?: number;
        code?: string | number;
        message?: string;
      }
    | undefined;

  const sqlServerUnique = driver?.number === 2627 || driver?.number === 2601;
  const sqliteUnique =
    driver?.code === 'SQLITE_CONSTRAINT' ||
    driver?.code === 19 ||
    driver?.code === 'SQLITE_CONSTRAINT_UNIQUE';

  const combined = `${error.message} ${driver?.message ?? ''} ${String(driver?.code ?? '')}`;
  const uniqueByMessage = /UNIQUE|unique constraint|duplicate key/i.test(
    combined,
  );

  if (!sqlServerUnique && !sqliteUnique && !uniqueByMessage) {
    return false;
  }

  const looksLikeOtherConstraint =
    /FOREIGN KEY|FOREIGN_KEY|NOT NULL|CHECK constraint|547\b/i.test(combined);
  if (looksLikeOtherConstraint) {
    return false;
  }

  return true;
}
